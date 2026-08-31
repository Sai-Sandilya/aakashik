import { validateReminderSubscribe } from '../lib/validation.js';
import { sendReminderConfirmationEmail } from './reminder-email.js';

export function subscribeReminder(db, body = {}) {
  const { email, remindTime, timezone } = validateReminderSubscribe(body);
  const now = Date.now();

  const existing = db.prepare(
    'SELECT id, email, remind_time, timezone, subscribed_at FROM ritual_reminders WHERE lower(email) = lower(?)',
  ).get(email);

  if (existing) {
    db.prepare(
      'UPDATE ritual_reminders SET remind_time = ?, timezone = ?, updated_at = ? WHERE id = ?',
    ).run(remindTime, timezone, now, existing.id);
    sendReminderConfirmationEmail({ to: email, remindTime, timezone }).catch((err) => {
      console.error('[reminders] confirmation email failed:', err?.message || err);
    });
    return {
      email: existing.email,
      time: remindTime,
      timezone,
      subscribedAt: existing.subscribed_at,
      duplicate: true,
    };
  }

  db.prepare(
    'INSERT INTO ritual_reminders (email, remind_time, timezone, subscribed_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ).run(email, remindTime, timezone, now, now);

  sendReminderConfirmationEmail({ to: email, remindTime, timezone }).catch((err) => {
    console.error('[reminders] confirmation email failed:', err?.message || err);
  });

  return { email, time: remindTime, timezone, subscribedAt: now, duplicate: false };
}
