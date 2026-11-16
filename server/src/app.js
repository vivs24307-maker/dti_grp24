import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { HttpError } from './lib/errors.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import catalogRoutes from './routes/catalog.js';
import showRoutes from './routes/shows.js';
import bookingRoutes from './routes/bookings.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  // Auth lives in an httpOnly cookie, so browsers must be allowed to send credentials -
  // which in turn requires an explicit origin allow-list (never '*').
  const origins = config.clientOrigin.split(',').map((o) => o.trim()).filter(Boolean);
  app.use(cors({ origin: origins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/shows', showRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', catalogRoutes);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));

  // In production the Express server also serves the built React app.
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side' });
  });

  return app;
}
