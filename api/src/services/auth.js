import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';

export function verifyAdminCredentials(db, email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  const row = db.prepare('SELECT id, email, name, password FROM admin_users WHERE lower(email) = ?').get(normalized);
  if (!row || row.password !== password) {
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
