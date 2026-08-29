import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';
import { createRateLimit } from '../lib/rate-limit.js';
import {
  createOAuthState,
  exchangeGoogleCode,
  fetchGoogleProfile,
  parseRememberMe,
  publicUser,
  readCustomerSession,
  sessionCookieOptions,
  setCustomerSession,
  upsertGoogleUser,
  verifyOAuthState,
} from '../services/customer-auth.js';
import { sendSignupOtp, sendPasswordResetOtp, verifySignupOtp, verifyPasswordResetOtp } from '../services/email-otp.js';
import { hashPassword, verifyPassword } from '../services/password.js';
import { withTransaction } from '../db/transaction.js';

const customerAuthRateLimit = createRateLimit({ windowMs: 60_000, max: 30 });

export default async function customerAuthRoutes(fastify) {
  if (!config.isTest) {
    fastify.addHook('onRequest', customerAuthRateLimit);
  }

  fastify.get('/auth/google', async (_request, reply) => {
    if (!config.googleClientId || !config.googleClientSecret) {
      throw new ApiError(503, 'google_not_configured', 'Google sign-in is not configured on the server yet');
    }

    const state = createOAuthState();
    reply.setCookie(config.oauthStateCookieName, state, sessionCookieOptions(600));

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', config.googleClientId);
    url.searchParams.set('redirect_uri', config.googleRedirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('access_type', 'online');
    url.searchParams.set('prompt', 'select_account');

    return reply.redirect(url.toString());
  });

  fastify.get('/auth/google/callback', async (request, reply) => {
    const err = request.query.error;
    if (err) {
      return reply.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(String(err))}`);
    }

    const code = request.query.code;
    const state = request.query.state;
    const savedState = request.cookies?.[config.oauthStateCookieName];

    try {
      verifyOAuthState(state);
      if (!savedState || savedState !== state) throw new Error('state mismatch');
    } catch {
      return reply.redirect(`${config.frontendUrl}/login?error=oauth_state`);
    }

    reply.clearCookie(config.oauthStateCookieName, sessionCookieOptions(0));

    try {
      const tokenData = await exchangeGoogleCode(code);
      const profile = await fetchGoogleProfile(tokenData.access_token);
      const user = upsertGoogleUser(fastify.db, profile);
      setCustomerSession(reply, user, true);
      return reply.redirect(`${config.frontendUrl}/login?signed_in=google`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'google_signin_failed';
      return reply.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(msg)}`);
    }
  });

  fastify.get('/auth/me', async (request) => {
    const session = readCustomerSession(request, fastify.db);
    if (!session) return { loggedIn: false, user: null };

    const row = fastify.db.prepare(
      'SELECT id, email, name, phone, google_id, avatar FROM users WHERE id = ?',
    ).get(Number(session.sub));

    return { loggedIn: true, user: publicUser(row) };
  });

  // Kept for internal/admin tooling only — does not reveal account existence to anonymous clients.
  // Public signup/reset must not call this; use send-otp instead.
  fastify.post('/auth/check-account', async (request) => {
    const email = String(request.body?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, 'invalid_email', 'Enter a valid email address.');
    }
    // Always return the same opaque shape to prevent email enumeration.
    return { ok: true };
  });

  fastify.post('/auth/send-otp', async (request) => {
    const email = String(request.body?.email || '').trim().toLowerCase();
    const name = String(request.body?.name || '').trim();
    const purpose = String(request.body?.purpose || 'signup');
    if (purpose === 'signup') return sendSignupOtp(fastify.db, { email, name });
    if (purpose === 'reset') return sendPasswordResetOtp(fastify.db, { email });
    throw new ApiError(400, 'invalid_purpose', 'Unsupported verification purpose.');
  });

  fastify.post('/auth/verify-signup', async (request, reply) => {
    const email = String(request.body?.email || '').trim().toLowerCase();
    const code = String(request.body?.code || '').trim();
    const name = String(request.body?.name || '').trim();
    const password = String(request.body?.password || '');
    const rememberMe = parseRememberMe(request.body?.rememberMe);

    if (!name) throw new ApiError(400, 'validation_error', 'Please enter your full name.');
    if (!password || password.length < 8) {
      throw new ApiError(400, 'validation_error', 'Password must be at least 8 characters.');
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      throw new ApiError(400, 'validation_error', 'Password must include upper, lower, number and symbol.');
    }

    const pwHash = await hashPassword(password);
    const now = Date.now();

    let user;
    try {
      user = withTransaction(fastify.db, () => {
        const existing = fastify.db.prepare(
          'SELECT id, google_id FROM users WHERE lower(email) = ?',
        ).get(email);
        if (existing) {
          throw new ApiError(409, 'account_exists', 'An account already exists for this email. Sign in instead.');
        }

        verifySignupOtp(fastify.db, { email, code });

        const result = fastify.db.prepare(`
          INSERT INTO users (email, name, phone, google_id, avatar, password_hash, verified, created_at, updated_at)
          VALUES (?, ?, '', NULL, '', ?, 1, ?, ?)
        `).run(email, name, pwHash, now, now);

        return fastify.db.prepare(
          'SELECT id, email, name, phone, google_id, avatar, session_version FROM users WHERE id = ?',
        ).get(result.lastInsertRowid);
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const msg = String(err?.message || '');
      if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE' || msg.includes('UNIQUE constraint failed')) {
        throw new ApiError(409, 'account_exists', 'An account already exists for this email. Sign in instead.');
      }
      throw err;
    }

    setCustomerSession(reply, user, rememberMe);
    return { ok: true, user: publicUser(user) };
  });

  fastify.post('/auth/reset-password', async (request, reply) => {
    const email = String(request.body?.email || '').trim().toLowerCase();
    const code = String(request.body?.code || '').trim();
    const password = String(request.body?.password || '');

    if (!/^\d{4}$/.test(code)) {
      throw new ApiError(400, 'otp_invalid', 'Enter the 4-digit verification code.');
    }
    if (!password || password.length < 8) {
      throw new ApiError(400, 'validation_error', 'Password must be at least 8 characters.');
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      throw new ApiError(400, 'validation_error', 'Password must include upper, lower, number and symbol.');
    }

    const normalized = verifyPasswordResetOtp(fastify.db, { email, code });
    const row = fastify.db.prepare(
      'SELECT id, google_id FROM users WHERE lower(email) = ?',
    ).get(normalized);

    if (!row || row.google_id) {
      throw new ApiError(400, 'no_account', 'No account found for this email.');
    }

    const pwHash = await hashPassword(password);
    const now = Date.now();
    fastify.db.prepare(`
      UPDATE users
      SET password_hash = ?, session_version = COALESCE(session_version, 0) + 1, updated_at = ?
      WHERE id = ?
    `).run(pwHash, now, row.id);

    reply.clearCookie(config.sessionCookieName, sessionCookieOptions(0));
    return { ok: true };
  });

  fastify.post('/auth/login', async (request, reply) => {
    const email = String(request.body?.email || '').trim().toLowerCase();
    const password = String(request.body?.password || '');
    const rememberMe = parseRememberMe(request.body?.rememberMe);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new ApiError(400, 'invalid_email', 'Enter a valid email address.');
    }
    if (!password) throw new ApiError(401, 'invalid_credentials', 'Incorrect email or password');

    const row = fastify.db.prepare(
      'SELECT id, email, name, phone, google_id, avatar, password_hash, session_version FROM users WHERE lower(email) = ?',
    ).get(email);

    if (!row) {
      throw new ApiError(401, 'invalid_credentials', 'Incorrect email or password');
    }
    if (row.google_id) {
      throw new ApiError(401, 'google_account', 'This account uses Google sign-in. Please click Continue with Google.');
    }
    if (!row.password_hash) {
      throw new ApiError(401, 'invalid_credentials', 'Incorrect email or password');
    }

    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) throw new ApiError(401, 'invalid_credentials', 'Incorrect email or password');

    setCustomerSession(reply, row, rememberMe);
    return { ok: true, user: publicUser(row) };
  });

  fastify.post('/auth/logout', async (_request, reply) => {
    reply.clearCookie(config.sessionCookieName, sessionCookieOptions(0));
    reply.clearCookie(config.oauthStateCookieName, sessionCookieOptions(0));
    return { ok: true };
  });
}
