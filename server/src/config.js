import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEV_JWT_SECRET = 'cineverse-dev-secret-change-me';
// Secrets that are public knowledge (the dev fallback and the .env.example placeholder).
const KNOWN_JWT_SECRETS = [DEV_JWT_SECRET, 'change-me-to-a-long-random-string'];

/** In production the server must not boot with a missing or publicly known signing secret. */
export function resolveJwtSecret(env = process.env) {
  const secret = (env.JWT_SECRET || '').trim();
  if (env.NODE_ENV === 'production' && (!secret || KNOWN_JWT_SECRETS.includes(secret))) {
    throw new Error(
      'JWT_SECRET must be set to a long random string in production (it is missing or still the default). Refusing to start.',
    );
  }
  return secret || DEV_JWT_SECRET;
}

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

export const config = {
  port: Number(process.env.PORT) || 5000,
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbFile: process.env.DB_FILE || path.join(__dirname, '..', 'data', 'cineverse.db'),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  isProd,
  isTest,
  authCookieName: 'cineverse_session',

  // Requests allowed per user per minute (read on every request, so tests can tighten them).
  rateLimits: {
    hold: isTest ? 1000 : 20,
    booking: isTest ? 1000 : 10,
  },

  // Business rules
  seatHoldMinutes: 10,
  maxSeatsPerBooking: 10,
  convenienceFeePerTicket: 30,
  gstOnFee: 0.18,
  premiumDiscount: 0.1,
  premiumPlanPrice: 299,
  cancellationCutoffHours: 2,
  cancellationFeePercent: 0.2,
  showDaysAhead: 7,
};
