import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import * as data from './seedData.js';
import { ensureShows } from './lib/shows.js';

export const slugify = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-');

const TABLES = ['booked_seats', 'bookings', 'seat_holds', 'reviews', 'shows', 'screens', 'theatres', 'movies', 'users', 'cities', 'coupons', 'food_items'];

export function seed(db, { reset = false } = {}) {
  if (reset) {
    db.transaction(() => {
      for (const t of TABLES) db.prepare(`DELETE FROM ${t}`).run();
      db.prepare("DELETE FROM sqlite_sequence").run();
    })();
  }

  const alreadySeeded = db.prepare('SELECT COUNT(*) AS n FROM cities').get().n > 0;
  if (alreadySeeded) return false;

  db.transaction(() => {
    const cityIds = {};
    const insCity = db.prepare('INSERT INTO cities (name, slug, state) VALUES (?, ?, ?)');
    for (const c of data.cities) cityIds[c.slug] = insCity.run(c.name, c.slug, c.state).lastInsertRowid;

    const insTheatre = db.prepare('INSERT INTO theatres (city_id, name, brand, address, amenities) VALUES (?, ?, ?, ?, ?)');
    const insScreen = db.prepare('INSERT INTO screens (theatre_id, name, format, layout) VALUES (?, ?, ?, ?)');
    for (const t of data.theatres) {
      const tid = insTheatre.run(cityIds[t.city], t.name, t.brand, t.address, JSON.stringify(t.amenities)).lastInsertRowid;
      for (const s of t.screens) insScreen.run(tid, s.name, s.format, JSON.stringify(s.layout));
    }

    const insMovie = db.prepare(`
      INSERT INTO movies (title, slug, genres, languages, duration_min, certificate, release_date, description,
                          director, cast_list, poster_url, backdrop_url, status)
      VALUES (@title, @slug, @genres, @languages, @duration_min, @certificate, @release_date, @description,
              @director, @cast_list, @poster_url, @backdrop_url, @status)`);
    for (const m of data.movies) {
      insMovie.run({
        ...m,
        slug: slugify(m.title),
        genres: JSON.stringify(m.genres),
        languages: JSON.stringify(m.languages),
        cast_list: JSON.stringify(m.cast),
        backdrop_url: m.backdrop_url ?? m.poster_url,
        status: m.status ?? 'now_showing',
      });
    }

    const insFood = db.prepare('INSERT INTO food_items (name, category, price, emoji, veg) VALUES (?, ?, ?, ?, ?)');
    for (const f of data.foodItems) insFood.run(f.name, f.category, f.price, f.emoji, f.veg ?? 1);

    const insCoupon = db.prepare(`INSERT INTO coupons (code, description, type, value, max_discount, min_amount)
                                  VALUES (@code, @description, @type, @value, @max_discount, @min_amount)`);
    for (const c of data.coupons) insCoupon.run(c);

    const insUser = db.prepare(`INSERT INTO users (name, email, password_hash, role, plan, city_id)
                                VALUES (?, ?, ?, ?, ?, ?)`);
    for (const u of data.users) {
      insUser.run(u.name, u.email, bcrypt.hashSync(u.password, 10), u.role, u.plan, cityIds.mumbai);
    }

    // A few starter reviews so ratings aren't empty on a fresh install
    const insReview = db.prepare('INSERT INTO reviews (movie_id, user_id, rating, comment) VALUES (?, ?, ?, ?)');
    const starters = [
      [1, 2, 9, 'Gripping from start to end. Ranveer is in top form!'],
      [12, 2, 9, 'Watch it in IMAX. The sound design is unreal.'],
      [18, 2, 10, 'Still gives me goosebumps every single time.'],
      [10, 2, 9, 'Restart. Such an inspiring story.'],
      [5, 2, 8, 'Funny and scary at the same time.'],
    ];
    for (const r of starters) insReview.run(...r);
  })();

  ensureShows(db);
  return true;
}

// `npm run seed` -> wipe and re-seed the database
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { db } = await import('./db.js');
  seed(db, { reset: process.argv.includes('--reset') });
  const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  console.log(`Seeded: ${count('cities')} cities, ${count('theatres')} theatres, ${count('movies')} movies, ${count('shows')} shows`);
  console.log('Logins -> admin@cineverse.com / admin123   |   demo@cineverse.com / demo123');
}
