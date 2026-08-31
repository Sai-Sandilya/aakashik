import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';
import { hashPassword, verifyPassword, isPasswordHash } from './password.js';

function timingSafeStringEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

async function upgradePlaintextPassword(db, adminId, password) {
  const hashed = await hashPassword(password);
  db.prepare('UPDATE admin_users SET password = ? WHERE id = ?').run(hashed, adminId);
}

export async function verifyAdminCredentials(db, email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  const row = db.prepare('SELECT id, email, name, password FROM admin_users WHERE lower(email) = ?').get(normalized);
  if (!row) {
    throw new ApiError(401, 'invalid_credentials', 'Incorrect admin email or password');
  }

  let ok = false;
  if (isPasswordHash(row.password)) {
    ok = await verifyPassword(password, row.password);
  } else {
    ok = timingSafeStringEqual(row.password, password);
    if (ok) await upgradePlaintextPassword(db, row.id, password);
  }

  if (!ok) {
    throw new ApiError(401, 'invalid_credentials', 'Incorrect admin email or password');
  }

  return { id: row.id, email: row.email, name: row.name };
}

export function signAdminToken(admin) {
  return jwt.sign({ sub: String(admin.id), email: admin.email, role: 'admin' }, config.jwtSecret, { expiresIn: '8h' });
}

export function verifyAdminToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.role !== 'admin') throw new Error('not admin');
    return payload;
  } catch {
    throw new ApiError(401, 'unauthorized', 'Admin authentication required');
  }
}

export function requireAdmin(request) {
  const header = request.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError(401, 'unauthorized', 'Admin authentication required');
  return verifyAdminToken(match[1]);
}
