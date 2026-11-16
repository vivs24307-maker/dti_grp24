import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import * as data from './seedData.js';
import { getMeta, setMeta } from './db.js';
import { ensureShows, PROGRAMME_VERSION, clearUnsoldFutureShows } from './lib/shows.js';
import { normaliseTech } from './lib/formats.js';

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
  if (alreadySeeded) {
    syncCatalogue(db);
    return false;
  }

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

    for (const m of data.movies) insertMovie(db, m);

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

  setMeta(db, 'programme_version', PROGRAMME_VERSION);
  ensureShows(db);
  return true;
}

function insertMovie(db, m) {
  db.prepare(`
    INSERT INTO movies (title, slug, genres, languages, duration_min, certificate, release_date, description,
                        director, cast_list, poster_url, backdrop_url, status, tagline, featured, has_3d)
    VALUES (@title, @slug, @genres, @languages, @duration_min, @certificate, @release_date, @description,
            @director, @cast_list, @poster_url, @backdrop_url, @status, @tagline, @featured, @has_3d)`).run({
    title: m.title,
    slug: slugify(m.title),
    genres: JSON.stringify(m.genres),
    languages: JSON.stringify(m.languages),
    duration_min: m.duration_min,
    certificate: m.certificate,
    release_date: m.release_date,
    description: m.description,
    director: m.director,
    cast_list: JSON.stringify(m.cast),
    poster_url: m.poster_url,
    backdrop_url: m.backdrop_url ?? m.poster_url,
    status: m.status ?? 'now_showing',
    tagline: m.tagline ?? null,
    featured: m.featured ? 1 : 0,
    has_3d: m.has_3d ? 1 : 0,
  });
}

/**
 * Brings a database that was seeded by an older version up to date WITHOUT wiping it:
 * adds new films and screens from seedData, and re-plans future shows when the programme rules change.
 * Users, bookings, reviews and anything edited in the admin dashboard are left alone.
 */
export function syncCatalogue(db) {
  db.transaction(() => {
    const known = new Set(db.prepare('SELECT slug FROM movies').all().map((r) => r.slug));
    for (const m of data.movies) {
      if (!known.has(slugify(m.title))) insertMovie(db, m);
      else if (m.has_3d) db.prepare('UPDATE movies SET has_3d = 1 WHERE slug = ?').run(slugify(m.title));
    }

    // Screens stored before formats existed ('2D' / '3D') become standard screens
    for (const s of db.prepare('SELECT id, format FROM screens').all()) {
      const tech = normaliseTech(s.format);
      if (tech !== s.format) db.prepare('UPDATE screens SET format = ? WHERE id = ?').run(tech, s.id);
    }
    const findTheatre = db.prepare('SELECT id FROM theatres WHERE name = ?');
    const findScreen = db.prepare('SELECT id FROM screens WHERE theatre_id = ? AND name = ?');
    const insScreen = db.prepare('INSERT INTO screens (theatre_id, name, format, layout) VALUES (?, ?, ?, ?)');
    for (const t of data.theatres) {
      const theatre = findTheatre.get(t.name);
      if (!theatre) continue;
      for (const s of t.screens) {
        if (!findScreen.get(theatre.id, s.name)) insScreen.run(theatre.id, s.name, s.format, JSON.stringify(s.layout));
      }
    }

    if (getMeta(db, 'programme_version') !== String(PROGRAMME_VERSION)) {
      clearUnsoldFutureShows(db);
      setMeta(db, 'programme_version', PROGRAMME_VERSION);
    }
  })();
}

// `npm run seed` -> wipe and re-seed the database
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { db } = await import('./db.js');
  seed(db, { reset: process.argv.includes('--reset') });
  const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  console.log(`Seeded: ${count('cities')} cities, ${count('theatres')} theatres, ${count('movies')} movies, ${count('shows')} shows`);
  console.log('Logins -> admin@cineverse.com / admin123   |   demo@cineverse.com / demo123');
}
