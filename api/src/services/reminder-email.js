import nodemailer from 'nodemailer';
import { config } from '../config.js';

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
    console.error('[reminder-email] SMTP primary send failed:', primaryErr?.message || primaryErr);
    if (config.smtpPort === 465) {
      await mailer(587, false).sendMail(message);
      return;
    }
    throw primaryErr;
  }
}

function formatTime12h(time24) {
  const [hStr, mStr] = String(time24).split(':');
  let h = Number(hStr);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

export async function sendReminderConfirmationEmail({ to, remindTime, timezone }) {
  if (config.isTest || !smtpReady()) return;

  const displayName = String(to).split('@')[0] || 'friend';
  const when = `${formatTime12h(remindTime)} (${timezone})`;
  await sendMailWithFallback({
    from: config.smtpFrom,
    to,
    replyTo: config.smtpUser,
    subject: 'Your Aakashik ritual reminder is set',
    text: `Hi ${displayName},\n\nYou're scheduled for gentle daily ritual reminders at ${when}.\n\nWe'll email you when scheduled delivery goes live. You can update your reminder anytime on aakashikwellness.com.\n\n— Aakashik Wellness`,
    html: `
      <div style="font-family:Georgia,serif;color:#2E3D2C;max-width:480px">
        <p>Hi ${displayName},</p>
        <p>You're scheduled for gentle daily ritual reminders at <strong>${when}</strong>.</p>
        <p style="color:#5E6A54;font-size:14px">We'll email you when scheduled delivery goes live. You can update your reminder anytime on aakashikwellness.com.</p>
        <p style="color:#8A9678;font-size:13px">— Aakashik Wellness</p>
      </div>
    `,
  });
}
