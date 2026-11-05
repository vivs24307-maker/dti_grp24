import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT) || 5000,
  jwtSecret: process.env.JWT_SECRET || 'cineverse-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbFile: process.env.DB_FILE || path.join(__dirname, '..', 'data', 'cineverse.db'),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

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
