import { config } from '../config.js';
import { addDays, toLocalDate } from './time.js';

const BASE_SLOTS = ['09:00', '13:00', '17:00', '21:00'];

function shiftTime(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function priceFactor(date, time) {
  const day = date.getDay();
  let f = 1;
  if (day === 0 || day === 6) f += 0.15; // weekend
  if (time < '12:00') f -= 0.2;           // morning show
  return Number(f.toFixed(2));
}

/**
 * Makes sure every screen has a programme for the next N days.
 * Idempotent: (screen_id, starts_at) is unique, so re-running only fills gaps.
 * This keeps the demo alive forever without anyone having to re-seed.
 */
export function ensureShows(db, days = config.showDaysAhead) {
  const movies = db
    .prepare("SELECT id, languages FROM movies WHERE status = 'now_showing' ORDER BY id")
    .all()
    .map((m) => ({ ...m, languages: JSON.parse(m.languages) }));
  if (!movies.length) return 0;

  const screens = db.prepare('SELECT id, format FROM screens ORDER BY id').all();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO shows (movie_id, screen_id, starts_at, language, format, price_factor)
    VALUES (?, ?, ?, ?, ?, ?)`);

  let created = 0;
  const today = new Date();
  db.transaction(() => {
    for (let d = 0; d < days; d++) {
      const date = addDays(today, d);
      const ymd = toLocalDate(date);
      // day-of-year keeps the rotation stable no matter when the server restarts
      const dayIndex = Math.floor(date.getTime() / 86_400_000);
      screens.forEach((screen, si) => {
        BASE_SLOTS.forEach((slot, k) => {
          const time = shiftTime(slot, (si % 4) * 15);
          const movie = movies[(si * 3 + k + dayIndex) % movies.length];
          const language = movie.languages[(si + k) % movie.languages.length] || 'Hindi';
          const res = insert.run(movie.id, screen.id, `${ymd}T${time}`, language, screen.format, priceFactor(date, time));
          created += res.changes;
        });
      });
    }
  })();
  return created;
}

/** Remove expired seat holds. */
export function purgeExpiredHolds(db) {
  return db.prepare('DELETE FROM seat_holds WHERE expires_at <= ?').run(Date.now()).changes;
}
