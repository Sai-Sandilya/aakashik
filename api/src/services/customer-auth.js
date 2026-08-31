import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';

export function createOAuthState() {
  return jwt.sign(
    { purpose: 'google_oauth', nonce: crypto.randomBytes(16).toString('hex') },
    config.jwtSecret,
    { expiresIn: '10m' },
  );
}

export function verifyOAuthState(state) {
  const payload = jwt.verify(String(state || ''), config.jwtSecret);
  if (payload.purpose !== 'google_oauth') throw new Error('invalid oauth state');
  return payload;
}

const SESSION_TTL_SEC = 60 * 60 * 24 * 30;

export function parseRememberMe(value) {
  return value !== false && value !== 'false' && value !== 0 && value !== '0';
}

export function signCustomerToken(user, { rememberMe = true } = {}) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      name: user.name || '',
      role: 'customer',
      sv: Number(user.session_version || 0),
    },
    config.jwtSecret,
    { expiresIn: rememberMe ? '30d' : '12h' },
  );
}

export function verifyCustomerToken(token) {
  try {
    const payload = jwt.verify(String(token || ''), config.jwtSecret);
    if (payload.role !== 'customer') throw new Error('not customer');
    return payload;
  } catch {
    throw new ApiError(401, 'unauthorized', 'Sign in required');
  }
}

export function readCustomerSession(request, db) {
  const token = request.cookies?.[config.sessionCookieName];
  if (!token) return null;
  try {
    const payload = jwt.verify(String(token || ''), config.jwtSecret);
    if (payload.role !== 'customer') return null;
    if (!db) return payload;
    const row = db.prepare('SELECT id, session_version FROM users WHERE id = ?').get(Number(payload.sub));
    if (!row) return null;
    if (Number(payload.sv || 0) !== Number(row.session_version || 0)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieMaxAge(rememberMe) {
  return rememberMe ? SESSION_TTL_SEC : undefined;
}

export function setCustomerSession(reply, user, rememberMe = true) {
  const token = signCustomerToken(user, { rememberMe });
  reply.setCookie(config.sessionCookieName, token, sessionCookieOptions(sessionCookieMaxAge(rememberMe)));
}

export function sessionCookieOptions(maxAgeSec) {
  const opts = {
    path: '/',
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
  };
  if (config.cookieDomain) opts.domain = config.cookieDomain;
  if (typeof maxAgeSec === 'number') opts.maxAge = maxAgeSec <= 0 ? 0 : maxAgeSec;
  return opts;
}

export async function exchangeGoogleCode(code) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: String(code || ''),
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleRedirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new ApiError(502, 'google_token_error', data.error_description || 'Could not exchange Google authorization code');
  }
  return data;
}

export async function fetchGoogleProfile(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.email) {
    throw new ApiError(502, 'google_profile_error', 'Could not load Google profile');
  }
  return data;
}

export function upsertGoogleUser(db, profile) {
  const email = String(profile.email || '').trim().toLowerCase();
  const googleId = String(profile.sub || profile.id || '').trim();
  const name = String(profile.name || profile.given_name || email.split('@')[0] || 'Guest').trim();
  const avatar = String(profile.picture || '').trim();
  const now = Date.now();

  const byGoogle = googleId
    ? db.prepare('SELECT id, email, name, phone, google_id, avatar FROM users WHERE google_id = ?').get(googleId)
    : null;
  const byEmail = db.prepare('SELECT id, email, name, phone, google_id, avatar FROM users WHERE lower(email) = ?').get(email);

  if (byGoogle) {
    db.prepare(`
      UPDATE users SET email = ?, name = ?, avatar = ?, verified = 1, updated_at = ?
      WHERE id = ?
    `).run(email, name, avatar, now, byGoogle.id);
    return db.prepare('SELECT id, email, name, phone, google_id, avatar FROM users WHERE id = ?').get(byGoogle.id);
  }

  if (byEmail) {
    db.prepare(`
      UPDATE users SET google_id = ?, name = ?, avatar = ?, verified = 1, updated_at = ?
      WHERE id = ?
    `).run(googleId || null, name, avatar, now, byEmail.id);
    return db.prepare('SELECT id, email, name, phone, google_id, avatar FROM users WHERE id = ?').get(byEmail.id);
  }

  const result = db.prepare(`
    INSERT INTO users (email, name, phone, google_id, avatar, verified, created_at, updated_at)
    VALUES (?, ?, '', ?, ?, 1, ?, ?)
  `).run(email, name, googleId || null, avatar, now, now);

  return db.prepare('SELECT id, email, name, phone, google_id, avatar FROM users WHERE id = ?').get(result.lastInsertRowid);
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone || '',
    avatar: row.avatar || '',
    provider: row.google_id ? 'google' : 'local',
  };
}
