import { badRequest } from './errors.js';

export const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export function requireFields(body, fields) {
  const missing = fields.filter((f) => body?.[f] === undefined || body[f] === null || String(body[f]).trim() === '');
  if (missing.length) throw badRequest(`Missing required field(s): ${missing.join(', ')}`);
}

/** At least 8 characters with a letter and a number. */
export function assertStrongPassword(value, label = 'Password') {
  const pw = typeof value === 'string' ? value : '';
  if (pw.length < 8) throw badRequest(`${label} must be at least 8 characters`);
  if (pw.length > 128) throw badRequest(`${label} must be at most 128 characters`);
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    throw badRequest(`${label} must include at least one letter and one number`);
  }
}

export function toInt(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw badRequest(`Invalid ${name}`);
  return n;
}

export function cleanString(value, max = 500) {
  if (value === undefined || value === null) return null;
  return String(value).trim().slice(0, max);
}
