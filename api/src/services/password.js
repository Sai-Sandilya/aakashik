import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scryptAsync(String(password || ''), salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const raw = String(stored || '');
  const sep = raw.indexOf(':');
  if (sep < 1) return false;
  const salt = raw.slice(0, sep);
  const hash = raw.slice(sep + 1);
  const derived = await scryptAsync(String(password || ''), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(expected, derived);
}
