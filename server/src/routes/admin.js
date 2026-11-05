import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { BOOKING_SELECT } from '../lib/booking.js';
import { MOVIE_SELECT, formatBooking, formatMovie } from '../lib/format.js';
import { slugify } from '../seed.js';
import { cleanString, requireFields, toInt } from '../lib/validate.js';
import { parseLocal } from '../lib/time.js';

const router = Router();
router.use(requireAdmin);

router.get('/stats', (_req, res) => {
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const totals = one(`
    SELECT COUNT(*) AS bookings, COALESCE(SUM(total), 0) AS revenue,
           COALESCE(SUM(json_array_length(seats)), 0) AS tickets
    FROM bookings WHERE status = 'CONFIRMED'`);
  const users = one('SELECT COUNT(*) AS n, SUM(plan = \'Premium\') AS premium FROM users');
  const cancelled = one("SELECT COUNT(*) AS n FROM bookings WHERE status = 'CANCELLED'").n;

  const byMovie = db.prepare(`
    SELECT m.title, COUNT(b.id) AS bookings, COALESCE(SUM(b.total), 0) AS revenue
    FROM bookings b JOIN shows s ON s.id = b.show_id JOIN movies m ON m.id = s.movie_id
    WHERE b.status = 'CONFIRMED' GROUP BY m.id ORDER BY revenue DESC LIMIT 6`).all();

  const byCity = db.prepare(`
    SELECT c.name AS city, COUNT(b.id) AS bookings, COALESCE(SUM(b.total), 0) AS revenue
    FROM bookings b JOIN shows s ON s.id = b.show_id JOIN screens sc ON sc.id = s.screen_id
    JOIN theatres t ON t.id = sc.theatre_id JOIN cities c ON c.id = t.city_id
    WHERE b.status = 'CONFIRMED' GROUP BY c.id ORDER BY revenue DESC`).all();

  const daily = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS bookings, SUM(total) AS revenue
    FROM bookings WHERE status = 'CONFIRMED' AND created_at >= date('now', '-13 days')
    GROUP BY day ORDER BY day`).all();

  res.json({
    totals: { ...totals, users: users.n, premiumUsers: users.premium ?? 0, cancelled },
    byMovie, byCity, daily,
  });
});

router.get('/bookings', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rows = db.prepare(`${BOOKING_SELECT} ORDER BY b.created_at DESC, b.id DESC LIMIT ?`).all(limit);
  res.json({ bookings: rows.map(formatBooking) });
});

/* ----------------------------- Movies ----------------------------- */

const asList = (v) => (Array.isArray(v) ? v : String(v || '').split(','))
  .map((s) => String(s).trim()).filter(Boolean).slice(0, 20);

function movieParams(body) {
  return {
    title: cleanString(body.title, 120),
    genres: JSON.stringify(asList(body.genres)),
    languages: JSON.stringify(asList(body.languages)),
    duration_min: toInt(body.duration_min ?? body.durationMin ?? 120, 'duration'),
    certificate: ['U', 'UA', 'A', 'S'].includes(body.certificate) ? body.certificate : 'UA',
    release_date: cleanString(body.release_date, 10),
    description: cleanString(body.description, 2000),
    director: cleanString(body.director, 120),
    cast_list: JSON.stringify(asList(body.cast)),
    poster_url: cleanString(body.poster_url, 500),
    backdrop_url: cleanString(body.backdrop_url || body.poster_url, 500),
    trailer_url: cleanString(body.trailer_url, 500),
    status: ['now_showing', 'coming_soon', 'archived'].includes(body.status) ? body.status : 'now_showing',
  };
}

router.get('/movies', (_req, res) => {
  res.json({ movies: db.prepare(`${MOVIE_SELECT} ORDER BY m.id DESC`).all().map(formatMovie) });
});

router.post('/movies', (req, res) => {
  requireFields(req.body, ['title', 'genres', 'languages']);
  const p = movieParams(req.body);
  p.slug = slugify(p.title);
  if (db.prepare('SELECT 1 FROM movies WHERE slug = ?').get(p.slug)) throw conflict('A movie with this title already exists');
  const info = db.prepare(`
    INSERT INTO movies (title, slug, genres, languages, duration_min, certificate, release_date, description, director,
                        cast_list, poster_url, backdrop_url, trailer_url, status)
    VALUES (@title, @slug, @genres, @languages, @duration_min, @certificate, @release_date, @description, @director,
            @cast_list, @poster_url, @backdrop_url, @trailer_url, @status)`).run(p);
  res.status(201).json({ movie: formatMovie(db.prepare(`${MOVIE_SELECT} WHERE m.id = ?`).get(info.lastInsertRowid)) });
});

router.put('/movies/:id', (req, res) => {
  const id = toInt(req.params.id, 'movie id');
  const existing = db.prepare('SELECT * FROM movies WHERE id = ?').get(id);
  if (!existing) throw notFound('Movie not found');
  const merged = {
    ...existing,
    genres: JSON.parse(existing.genres),
    languages: JSON.parse(existing.languages),
    cast: JSON.parse(existing.cast_list),
    ...req.body,
  };
  const p = movieParams(merged);
  db.prepare(`
    UPDATE movies SET title=@title, genres=@genres, languages=@languages, duration_min=@duration_min,
      certificate=@certificate, release_date=@release_date, description=@description, director=@director,
      cast_list=@cast_list, poster_url=@poster_url, backdrop_url=@backdrop_url, trailer_url=@trailer_url, status=@status
    WHERE id=@id`).run({ ...p, id });
  res.json({ movie: formatMovie(db.prepare(`${MOVIE_SELECT} WHERE m.id = ?`).get(id)) });
});

/* ----------------------------- Shows ----------------------------- */

router.get('/screens', (_req, res) => {
  const screens = db.prepare(`
    SELECT sc.id, sc.name, sc.format, t.name AS theatre_name, c.name AS city_name
    FROM screens sc JOIN theatres t ON t.id = sc.theatre_id JOIN cities c ON c.id = t.city_id
    ORDER BY c.id, t.name, sc.name`).all();
  res.json({ screens });
});

router.post('/shows', (req, res) => {
  requireFields(req.body, ['movieId', 'screenId', 'startsAt', 'language']);
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(toInt(req.body.movieId, 'movie'));
  const screen = db.prepare('SELECT * FROM screens WHERE id = ?').get(toInt(req.body.screenId, 'screen'));
  if (!movie || !screen) throw notFound('Movie or screen not found');
  const startsAt = String(req.body.startsAt).slice(0, 16);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAt) || Number.isNaN(parseLocal(startsAt).getTime())) {
    throw badRequest('startsAt must look like 2026-01-31T18:30');
  }
  if (parseLocal(startsAt) < new Date()) throw badRequest('Show time must be in the future');

  // Make sure the new show doesn't overlap another one on the same screen (+20 min cleaning buffer)
  const start = parseLocal(startsAt).getTime();
  const end = start + (movie.duration_min + 20) * 60_000;
  const sameDay = db.prepare(`
    SELECT s.starts_at, m.duration_min FROM shows s JOIN movies m ON m.id = s.movie_id
    WHERE s.screen_id = ? AND substr(s.starts_at, 1, 10) BETWEEN date(?, '-1 day') AND date(?, '+1 day')`)
    .all(screen.id, startsAt.slice(0, 10), startsAt.slice(0, 10));
  const clash = sameDay.find((s) => {
    const sStart = parseLocal(s.starts_at).getTime();
    const sEnd = sStart + (s.duration_min + 20) * 60_000;
    return start < sEnd && sStart < end;
  });
  if (clash) throw conflict(`This screen is busy then (show at ${clash.starts_at.replace('T', ' ')})`);

  const factor = Number(req.body.priceFactor) > 0 ? Number(req.body.priceFactor) : 1;
  const info = db.prepare(`INSERT INTO shows (movie_id, screen_id, starts_at, language, format, price_factor)
                           VALUES (?, ?, ?, ?, ?, ?)`)
    .run(movie.id, screen.id, startsAt, cleanString(req.body.language, 30), screen.format, factor);
  res.status(201).json({ show: db.prepare('SELECT * FROM shows WHERE id = ?').get(info.lastInsertRowid) });
});

router.delete('/shows/:id', (req, res) => {
  const id = toInt(req.params.id, 'show id');
  const sold = db.prepare('SELECT COUNT(*) AS n FROM booked_seats WHERE show_id = ?').get(id).n;
  if (sold) throw conflict('Cannot delete a show that already has bookings');
  const info = db.prepare('DELETE FROM shows WHERE id = ?').run(id);
  if (!info.changes) throw notFound('Show not found');
  res.json({ ok: true });
});

/* ----------------------------- Coupons ----------------------------- */

router.get('/coupons', (_req, res) => {
  res.json({ coupons: db.prepare('SELECT * FROM coupons ORDER BY code').all() });
});

router.post('/coupons', (req, res) => {
  requireFields(req.body, ['code', 'description', 'type', 'value']);
  const type = String(req.body.type).toUpperCase();
  if (!['PERCENT', 'FLAT'].includes(type)) throw badRequest('type must be PERCENT or FLAT');
  const value = Number(req.body.value);
  if (!(value > 0) || (type === 'PERCENT' && value > 100)) throw badRequest('Invalid value');
  const code = cleanString(req.body.code, 20).toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) throw badRequest('Code must be 3-20 letters/numbers');
  if (db.prepare('SELECT 1 FROM coupons WHERE code = ?').get(code)) throw conflict('Coupon already exists');
  db.prepare(`INSERT INTO coupons (code, description, type, value, max_discount, min_amount) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(code, cleanString(req.body.description, 200), type, value,
      req.body.max_discount ? Number(req.body.max_discount) : null, Number(req.body.min_amount) || 0);
  res.status(201).json({ coupon: db.prepare('SELECT * FROM coupons WHERE code = ?').get(code) });
});

router.patch('/coupons/:code', (req, res) => {
  const info = db.prepare('UPDATE coupons SET active = ? WHERE code = ?').run(req.body.active ? 1 : 0, req.params.code);
  if (!info.changes) throw notFound('Coupon not found');
  res.json({ coupon: db.prepare('SELECT * FROM coupons WHERE code = ?').get(req.params.code) });
});

export default router;
