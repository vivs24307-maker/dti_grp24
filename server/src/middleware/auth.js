import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function publicUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
}

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProd,
  path: '/',
});

/** Signs the user in by setting the session cookie. The token never reaches page JavaScript. */
export function setAuthCookie(res, user) {
  const token = signToken(user);
  const { exp } = jwt.decode(token);
  res.cookie(config.authCookieName, token, { ...cookieOptions(), expires: new Date(exp * 1000) });
}

export function clearAuthCookie(res) {
  res.clearCookie(config.authCookieName, cookieOptions());
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      try { return decodeURIComponent(part.slice(eq + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

function loadUser(req) {
  const token = readCookie(req, config.authCookieName);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user) return null;
    // Lazily downgrade expired memberships
    if (user.plan === 'Premium' && user.plan_expires && new Date(user.plan_expires) < new Date()) {
      db.prepare("UPDATE users SET plan = 'Basic', plan_expires = NULL WHERE id = ?").run(user.id);
      user.plan = 'Basic';
      user.plan_expires = null;
    }
    return user;
  } catch {
    return null;
  }
}

/** Attaches req.user if a valid token is present, but never blocks. */
export function optionalAuth(req, _res, next) {
  req.user = loadUser(req);
  next();
}

export function requireAuth(req, _res, next) {
  req.user = loadUser(req);
  if (!req.user) return next(unauthorized());
  next();
}

export function requireAdmin(req, _res, next) {
  req.user = loadUser(req);
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'admin') return next(forbidden('Admins only'));
  next();
}
