import { createApp } from './app.js';
import { config } from './config.js';
import { db } from './db.js';
import { seed } from './seed.js';
import { ensureShows, purgeExpiredHolds } from './lib/shows.js';
import { notifySeats } from './lib/events.js';

if (seed(db)) console.log('🌱 Fresh database seeded with demo data');
const added = ensureShows(db);
if (added) console.log(`🎬 Scheduled ${added} new shows`);

// Housekeeping: keep the programme 7 days ahead and release expired seat holds.
setInterval(() => ensureShows(db), 60 * 60 * 1000).unref();
setInterval(() => purgeExpiredHolds(db, notifySeats), 30 * 1000).unref();

createApp().listen(config.port, () => {
  console.log(`🍿 CineVerse API running on http://localhost:${config.port}`);
});
