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
    console.error('[newsletter-email] SMTP primary send failed:', primaryErr?.message || primaryErr);
    if (config.smtpPort === 465) {
      await mailer(587, false).sendMail(message);
      return;
    }
    throw primaryErr;
  }
}

export async function sendNewsletterWelcomeEmail({ to }) {
  if (config.isTest || !smtpReady()) return;

  const displayName = String(to).split('@')[0] || 'friend';
  await sendMailWithFallback({
    from: config.smtpFrom,
    to,
    replyTo: config.smtpUser,
    subject: 'Welcome to the Aakashik Wellness newsletter',
    text: `Hi ${displayName},\n\nThank you for subscribing to our newsletter. You'll receive Ayurvedic wellness tips, seasonal rituals, and updates on new products.\n\n— Aakashik Wellness`,
    html: `
      <div style="font-family:Georgia,serif;color:#2E3D2C;max-width:480px">
        <p>Hi ${displayName},</p>
        <p>Thank you for subscribing to our newsletter. You'll receive Ayurvedic wellness tips, seasonal rituals, and updates on new products.</p>
        <p style="color:#8A9678;font-size:13px">— Aakashik Wellness</p>
      </div>
    `,
  });
}
