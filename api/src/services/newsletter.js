import { ApiError } from '../lib/errors.js';
import { validateNewsletterEmail } from '../lib/validation.js';
import { sendNewsletterWelcomeEmail } from './newsletter-email.js';

export function subscribeNewsletter(db, body = {}) {
  const email = validateNewsletterEmail(body.email);
  const now = Date.now();

  const existing = db.prepare(
    'SELECT id, email, subscribed_at FROM newsletter_subscribers WHERE lower(email) = lower(?)',
  ).get(email);

  if (existing) {
    return { email: existing.email, subscribedAt: existing.subscribed_at, duplicate: true };
  }

  db.prepare(
    'INSERT INTO newsletter_subscribers (email, subscribed_at) VALUES (?, ?)',
  ).run(email, now);

  sendNewsletterWelcomeEmail({ to: email }).catch((err) => {
    console.error('[newsletter] welcome email failed:', err?.message || err);
  });

  return { email, subscribedAt: now, duplicate: false };
}
