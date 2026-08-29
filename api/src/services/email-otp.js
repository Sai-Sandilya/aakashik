import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';

function smtpReady() {
  return !!(config.smtpHost && config.smtpUser && config.smtpPass);
}

function mailer(port = config.smtpPort, secure = config.smtpSecure) {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port,
    secure,
    auth: { user: config.smtpUser, pass: config.smtpPass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

async function sendMailWithFallback(message) {
  try {
    await mailer().sendMail(message);
    return;
  } catch (primaryErr) {
    console.error('[email-otp] SMTP primary send failed:', primaryErr?.message || primaryErr);
    if (config.smtpPort === 465) {
      try {
        await mailer(587, false).sendMail(message);
        return;
      } catch (fallbackErr) {
        console.error('[email-otp] SMTP fallback send failed:', fallbackErr?.message || fallbackErr);
        throw fallbackErr;
      }
    }
    throw primaryErr;
  }
}

export function generateOtpCode() {
  return String(1000 + Math.floor(Math.random() * 9000));
}

async function deliverOtpEmail({ to, displayName, code, subject, intro }) {
  if (config.isTest) return;

  if (!smtpReady()) {
    throw new ApiError(
      503,
      'email_not_configured',
      'Email verification is not configured yet. Please use Google sign-in or contact care@aakashikwellness.in.',
    );
  }

  try {
    await sendMailWithFallback({
      from: config.smtpFrom,
      to,
      replyTo: config.smtpUser,
      subject,
      text: `Hi ${displayName},\n\n${intro}\n\nYour code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, you can ignore this email.\n\n— Aakashik Wellness`,
      html: `
      <div style="font-family:Georgia,serif;color:#2E3D2C;max-width:480px">
        <p>Hi ${displayName},</p>
        <p>${intro}</p>
        <p style="font-size:28px;letter-spacing:0.25em;font-weight:bold;margin:24px 0">${code}</p>
        <p style="color:#5E6A54;font-size:14px">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
        <p style="color:#8A9678;font-size:13px">— Aakashik Wellness</p>
      </div>
    `,
    });
  } catch (err) {
    throw new ApiError(
      503,
      'email_send_failed',
      'Could not send email right now. Check spam/promotions, wait 2 minutes, then tap Resend — or contact info@aakashikwellness.com.',
    );
  }
}

function saveOtp(db, { email, code, purpose }) {
  const now = Date.now();
  const expiresAt = now + 10 * 60 * 1000;
  db.prepare('DELETE FROM otp_codes WHERE lower(email) = ? AND purpose = ?').run(email, purpose);
  db.prepare(`
    INSERT INTO otp_codes (email, code, purpose, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(email, code, purpose, expiresAt, now);
  return { ok: true, expiresIn: 600, ...(config.isTest ? { testCode: code } : {}) };
}

export function verifyOtp(db, { email, code, purpose }) {
  const normalized = String(email || '').trim().toLowerCase();
  const row = db.prepare(`
    SELECT id, code, expires_at FROM otp_codes
    WHERE lower(email) = ? AND purpose = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(normalized, purpose);

  if (!row) {
    throw new ApiError(400, 'no_otp', 'No active verification code. Please request a new one.');
  }
  if (Date.now() > row.expires_at) {
    db.prepare('DELETE FROM otp_codes WHERE id = ?').run(row.id);
    throw new ApiError(400, 'otp_expired', 'Verification code expired. Please request a new one.');
  }
  if (String(code || '').trim() !== String(row.code)) {
    throw new ApiError(400, 'otp_invalid', 'Incorrect verification code.');
  }

  db.prepare('DELETE FROM otp_codes WHERE id = ?').run(row.id);
  return normalized;
}

export async function sendSignupOtp(db, { email, name }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) {
    throw new ApiError(400, 'invalid_email', 'Enter a valid email address.');
  }

  const existing = db.prepare(
    'SELECT id, google_id FROM users WHERE lower(email) = ?',
  ).get(normalized);
  if (existing) {
    throw new ApiError(409, 'account_exists', 'An account already exists for this email. Sign in instead.');
  }

  const code = generateOtpCode();
  saveOtp(db, { email: normalized, code, purpose: 'signup' });

  const displayName = String(name || '').trim() || 'there';
  await deliverOtpEmail({
    to: normalized,
    displayName,
    code,
    subject: 'Your Aakashik verification code',
    intro: 'Your verification code for Aakashik Wellness is:',
  });

  return { ok: true, expiresIn: 600, ...(config.isTest ? { testCode: code } : {}) };
}

export async function sendPasswordResetOtp(db, { email }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) {
    throw new ApiError(400, 'invalid_email', 'Enter a valid email address.');
  }

  const row = db.prepare(
    'SELECT id, google_id, password_hash, name FROM users WHERE lower(email) = ?',
  ).get(normalized);

  // Anti-enumeration: always return the same success shape.
  // Only email a code when a local password account actually exists.
  const canReset = !!(row && !row.google_id && row.password_hash);
  if (!canReset) {
    return { ok: true, expiresIn: 600 };
  }

  const code = generateOtpCode();
  saveOtp(db, { email: normalized, code, purpose: 'reset' });

  const displayName = String(row.name || '').trim() || 'there';
  await deliverOtpEmail({
    to: normalized,
    displayName,
    code,
    subject: 'Your Aakashik verification code',
    intro: 'Use this code to reset your Aakashik Wellness password:',
  });

  return { ok: true, expiresIn: 600, ...(config.isTest ? { testCode: code } : {}) };
}

export function verifySignupOtp(db, params) {
  return verifyOtp(db, { ...params, purpose: 'signup' });
}

export function verifyPasswordResetOtp(db, params) {
  return verifyOtp(db, { ...params, purpose: 'reset' });
}
