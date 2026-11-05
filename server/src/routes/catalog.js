import { Router } from 'express';
import { db } from '../db.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { badRequest, notFound } from '../lib/errors.js';
import { MOVIE_SELECT, formatMovie, formatTheatre } from '../lib/format.js';
import { isValidDate, toLocalDate, toLocalDateTime } from '../lib/time.js';
import { cleanString } from '../lib/validate.js';
import { couponDiscount } from '../lib/pricing.js';

const router = Router();

/* ----------------------------- Cities ----------------------------- */

router.get('/cities', (_req, res) => {
  const cities = db
    .prepare(`SELECT c.*, COUNT(t.id) AS theatres FROM cities c
              LEFT JOIN theatres t ON t.city_id = c.id GROUP BY c.id ORDER BY c.id`)
    .all();
  res.json({ cities });
});

function cityBySlug(slug) {
  if (!slug) return null;
  const city = db.prepare('SELECT * FROM cities WHERE slug = ? OR id = ?').get(slug, Number(slug) || -1);
  if (!city) throw notFound('Unknown city');
  return city;
}

/* ----------------------------- Movies ----------------------------- */

router.get('/movies', (req, res) => {
  const { status = 'now_showing', genre, language, q, city, sort = 'popular' } = req.query;
  const where = [];
  const params = {};

  if (status !== 'all') {
    where.push('m.status = @status');
    params.status = status;
  } else {
    where.push("m.status != 'archived'");
  }
  if (genre) {
    where.push('EXISTS (SELECT 1 FROM json_each(m.genres) WHERE value = @genre)');
    params.genre = genre;
  }
  if (language) {
    where.push('EXISTS (SELECT 1 FROM json_each(m.languages) WHERE value = @language)');
    params.language = language;
  }
  if (q) {
    where.push('(m.title LIKE @q OR m.cast_list LIKE @q OR m.director LIKE @q)');
    params.q = `%${String(q).slice(0, 50)}%`;
  }
  if (city && status === 'now_showing') {
    const c = cityBySlug(city);
    where.push(`EXISTS (SELECT 1 FROM shows s JOIN screens sc ON sc.id = s.screen_id JOIN theatres t ON t.id = sc.theatre_id
                        WHERE s.movie_id = m.id AND t.city_id = @cityId AND s.starts_at >= @now)`);
    params.cityId = c.id;
    params.now = toLocalDateTime();
  }

  const order = {
    popular: 'votes DESC, rating DESC, m.id ASC',
    rating: 'rating DESC NULLS LAST, votes DESC',
    newest: 'm.release_date DESC',
    title: 'm.title COLLATE NOCASE ASC',
  }[sort] || 'm.id ASC';

  const rows = db.prepare(`${MOVIE_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order}`).all(params);
  res.json({ movies: rows.map(formatMovie) });
});

router.get('/movies/filters', (_req, res) => {
  const genres = db.prepare("SELECT DISTINCT value FROM movies, json_each(movies.genres) WHERE status != 'archived' ORDER BY value").all().map((r) => r.value);
  const languages = db.prepare("SELECT DISTINCT value FROM movies, json_each(movies.languages) WHERE status != 'archived' ORDER BY value").all().map((r) => r.value);
  res.json({ genres, languages });
});

function getMovie(idOrSlug) {
  const row = db.prepare(`${MOVIE_SELECT} WHERE m.id = ? OR m.slug = ?`).get(Number(idOrSlug) || -1, String(idOrSlug));
  if (!row) throw notFound('Movie not found');
  return formatMovie(row);
}

router.get('/movies/:id', (req, res) => {
  res.json({ movie: getMovie(req.params.id) });
});

/** Showtimes for a movie in a city on a date, grouped by theatre. */
router.get('/movies/:id/shows', (req, res) => {
  const movie = getMovie(req.params.id);
  const city = cityBySlug(req.query.city || 'mumbai');
  const date = req.query.date || toLocalDate();
  if (!isValidDate(date)) throw badRequest('Invalid date');

  const now = toLocalDateTime();
  const params = { movieId: movie.id, cityId: city.id, from: `${date}T00:00`, to: `${date}T23:59`, now };
  let sql = `
    SELECT s.id, s.starts_at, s.language, s.format, s.price_factor,
           sc.name AS screen_name, sc.layout, t.id AS theatre_id, t.name AS theatre_name, t.brand, t.address, t.amenities,
           (SELECT COUNT(*) FROM booked_seats b WHERE b.show_id = s.id) AS booked
    FROM shows s
    JOIN screens sc ON sc.id = s.screen_id
    JOIN theatres t ON t.id = sc.theatre_id
    WHERE s.movie_id = @movieId AND t.city_id = @cityId
      AND s.starts_at BETWEEN @from AND @to AND s.starts_at >= @now`;
  if (req.query.language) { sql += ' AND s.language = @language'; params.language = req.query.language; }
  if (req.query.format) { sql += ' AND s.format = @format'; params.format = req.query.format; }
  sql += ' ORDER BY t.name, s.starts_at';

  const theatres = new Map();
  for (const r of db.prepare(sql).all(params)) {
    if (!theatres.has(r.theatre_id)) {
      theatres.set(r.theatre_id, {
        id: r.theatre_id, name: r.theatre_name, brand: r.brand, address: r.address,
        amenities: JSON.parse(r.amenities), shows: [],
      });
    }
    const layout = JSON.parse(r.layout);
    const capacity = layout.categories.reduce((n, c) => n + c.rows.length * c.cols, 0);
    const prices = layout.categories.map((c) => Math.round((c.price * r.price_factor) / 10) * 10);
    theatres.get(r.theatre_id).shows.push({
      id: r.id, startsAt: r.starts_at, language: r.language, format: r.format, screen: r.screen_name,
      minPrice: Math.min(...prices), maxPrice: Math.max(...prices),
      occupancy: Number((r.booked / capacity).toFixed(2)),
    });
  }

  // Which dates/languages/formats exist at all (for the date strip and filter chips)
  const meta = db.prepare(`
    SELECT DISTINCT substr(s.starts_at, 1, 10) AS date, s.language, s.format FROM shows s
    JOIN screens sc ON sc.id = s.screen_id JOIN theatres t ON t.id = sc.theatre_id
    WHERE s.movie_id = ? AND t.city_id = ? AND s.starts_at >= ? ORDER BY date`).all(movie.id, city.id, now);

  res.json({
    movie,
    city,
    date,
    dates: [...new Set(meta.map((m) => m.date))],
    languages: [...new Set(meta.map((m) => m.language))],
    formats: [...new Set(meta.map((m) => m.format))],
    theatres: [...theatres.values()],
  });
});

/* ----------------------------- Reviews ----------------------------- */

router.get('/movies/:id/reviews', optionalAuth, (req, res) => {
  const movie = getMovie(req.params.id);
  const reviews = db.prepare(`
    SELECT r.id, r.rating, r.comment, r.created_at, r.user_id, u.name AS user_name
    FROM reviews r JOIN users u ON u.id = r.user_id
    WHERE r.movie_id = ? ORDER BY r.created_at DESC LIMIT 50`).all(movie.id);
  const mine = req.user ? reviews.find((r) => r.user_id === req.user.id) ?? null : null;
  res.json({ reviews, mine });
});

router.post('/movies/:id/reviews', requireAuth, (req, res) => {
  const movie = getMovie(req.params.id);
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) throw badRequest('Rating must be between 1 and 10');
  const comment = cleanString(req.body.comment, 1000);
  db.prepare(`
    INSERT INTO reviews (movie_id, user_id, rating, comment) VALUES (?, ?, ?, ?)
    ON CONFLICT (movie_id, user_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment,
      created_at = datetime('now')`).run(movie.id, req.user.id, rating, comment);
  res.status(201).json({ movie: getMovie(movie.id) });
});

/* ----------------------------- Theatres ----------------------------- */

router.get('/theatres', (req, res) => {
  const city = cityBySlug(req.query.city || 'mumbai');
  const theatres = db.prepare(`
    SELECT t.*, (SELECT GROUP_CONCAT(DISTINCT format) FROM screens WHERE theatre_id = t.id) AS formats
    FROM theatres t WHERE t.city_id = ? ORDER BY t.name`).all(city.id).map((t) => ({
      ...formatTheatre(t), formats: t.formats ? t.formats.split(',') : [],
    }));
  res.json({ city, theatres });
});

router.get('/theatres/:id', (req, res) => {
  const theatre = db.prepare('SELECT t.*, c.name AS city_name, c.slug AS city_slug FROM theatres t JOIN cities c ON c.id = t.city_id WHERE t.id = ?').get(req.params.id);
  if (!theatre) throw notFound('Theatre not found');
  const date = req.query.date || toLocalDate();
  if (!isValidDate(date)) throw badRequest('Invalid date');

  const rows = db.prepare(`
    SELECT s.id, s.starts_at, s.language, s.format, sc.name AS screen, m.id AS movie_id
    FROM shows s JOIN screens sc ON sc.id = s.screen_id JOIN movies m ON m.id = s.movie_id
    WHERE sc.theatre_id = ? AND s.starts_at BETWEEN ? AND ? AND s.starts_at >= ?
    ORDER BY m.title, s.starts_at`).all(theatre.id, `${date}T00:00`, `${date}T23:59`, toLocalDateTime());

  const movies = new Map();
  for (const r of rows) {
    if (!movies.has(r.movie_id)) movies.set(r.movie_id, { movie: getMovie(r.movie_id), shows: [] });
    movies.get(r.movie_id).shows.push({ id: r.id, startsAt: r.starts_at, language: r.language, format: r.format, screen: r.screen });
  }
  res.json({ theatre: formatTheatre(theatre), date, movies: [...movies.values()] });
});

/* ----------------------------- Food & offers ----------------------------- */

router.get('/food', (_req, res) => {
  res.json({ items: db.prepare('SELECT * FROM food_items ORDER BY category, price').all() });
});

router.get('/offers', (_req, res) => {
  res.json({ coupons: db.prepare('SELECT code, description, type, value, max_discount, min_amount FROM coupons WHERE active = 1').all() });
});

router.post('/offers/validate', (req, res) => {
  const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(String(req.body.code || '').trim());
  if (!coupon) throw badRequest('Invalid or expired coupon code');
  const amount = Number(req.body.amount) || 0;
  res.json({ code: coupon.code, description: coupon.description, discount: couponDiscount(coupon, amount) });
});

export default router;
