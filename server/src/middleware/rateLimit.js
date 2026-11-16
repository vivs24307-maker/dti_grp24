import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { config } from '../config.js';

/**
 * Per-user limiter for the endpoints that lock inventory. Mount it AFTER requireAuth so the
 * key is the account (a script can't dodge it by rotating IPs); it falls back to the IP otherwise.
 */
function inventoryLimiter(name, message) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: () => config.rateLimits[name],
    keyGenerator: (req) => (req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip)),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
  });
}

export const holdLimiter = inventoryLimiter('hold', 'You are selecting seats too quickly. Please wait a moment and try again.');
export const bookingLimiter = inventoryLimiter('booking', 'Too many booking attempts. Please wait a moment and try again.');
