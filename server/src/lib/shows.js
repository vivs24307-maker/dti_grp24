import { config } from '../config.js';
import { addDays, toLocalDate, toLocalDateTime } from './time.js';
import { formatLabel, techFactor } from './formats.js';

// Bump this when the scheduling rules change: databases on an older version get their
// unsold future shows re-planned on the next start (see syncCatalogue in seed.js).
export const PROGRAMME_VERSION = 2;

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
  return f;
}

/**
 * Makes sure every screen has a programme for the next N days.
 * Idempotent: (screen_id, starts_at) is unique, so re-running only fills gaps.
 * This keeps the demo alive forever without anyone having to re-seed.
 *
 * Programming rules:
 *  - the featured film gets every other show on premium screens (IMAX, 4DX, ScreenX...) and one show a day on standard ones
 *  - everything else rotates through the "now showing" list
 *  - films released in 3D alternate between the 2D and 3D flavour of the screen (IMAX 2D / IMAX 3D, ...)
 */
export function ensureShows(db, days = config.showDaysAhead) {
  const movies = db
    .prepare("SELECT id, languages, featured, has_3d FROM movies WHERE status = 'now_showing' ORDER BY id")
    .all()
    .map((m) => ({ ...m, languages: JSON.parse(m.languages) }));
  if (!movies.length) return 0;
  const featured = movies.filter((m) => m.featured);

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
      // day number keeps the rotation stable no matter when the server restarts
      const dayIndex = Math.floor(date.getTime() / 86_400_000);
      screens.forEach((screen, si) => {
        const premium = screen.format !== 'Standard';
        BASE_SLOTS.forEach((slot, k) => {
          const time = shiftTime(slot, (si % 4) * 15);
          const turn = si + k + dayIndex;
          const headline = featured.length && (premium ? turn % 2 === 0 : k === si % BASE_SLOTS.length);
          const movie = headline
            ? featured[turn % featured.length]
            : movies[(si * 3 + k + dayIndex) % movies.length];
          const is3d = Boolean(movie.has_3d) && (premium ? turn % 3 !== 1 : turn % 2 === 0);
          const language = movie.languages[(si + k) % movie.languages.length] || 'Hindi';
          const factor = Number((priceFactor(date, time) * techFactor(screen.format, is3d)).toFixed(2));
          const res = insert.run(movie.id, screen.id, `${ymd}T${time}`, language, formatLabel(screen.format, is3d), factor);
          created += res.changes;
        });
      });
    }
  })();
  return created;
}

/** Drop upcoming shows nobody has booked or is holding seats for, so they can be planned again. */
export function clearUnsoldFutureShows(db) {
  return db.prepare(`
    DELETE FROM shows
    WHERE starts_at >= ?
      AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.show_id = shows.id)
      AND NOT EXISTS (SELECT 1 FROM seat_holds h WHERE h.show_id = shows.id)`).run(toLocalDateTime()).changes;
}

/** Remove expired seat holds. */
export function purgeExpiredHolds(db, onShow) {
  const expired = db.prepare('SELECT DISTINCT show_id FROM seat_holds WHERE expires_at <= ?').all(Date.now());
  if (!expired.length) return 0;
  const { changes } = db.prepare('DELETE FROM seat_holds WHERE expires_at <= ?').run(Date.now());
  if (onShow) expired.forEach((r) => onShow(r.show_id));
  return changes;
}
