import crypto from 'node:crypto';
import { db, parseJson } from '../db.js';
import { badRequest, notFound } from './errors.js';
import { formatMovie, MOVIE_SELECT } from './format.js';
import { config } from '../config.js';

/** Load a show with everything the seat map / checkout needs. */
export function loadShow(showId) {
  const show = db.prepare(`
    SELECT s.*, sc.name AS screen_name, sc.layout, t.id AS theatre_id, t.name AS theatre_name, t.address,
           t.brand, c.name AS city_name, c.slug AS city_slug
    FROM shows s
    JOIN screens sc ON sc.id = s.screen_id
    JOIN theatres t ON t.id = sc.theatre_id
    JOIN cities c ON c.id = t.city_id
    WHERE s.id = ?`).get(showId);
  if (!show) throw notFound('Show not found');
  parseJson(show, 'layout');
  show.movie = formatMovie(db.prepare(`${MOVIE_SELECT} WHERE m.id = ?`).get(show.movie_id));
  return show;
}

export function normaliseSeats(seats) {
  if (!Array.isArray(seats) || !seats.length) throw badRequest('Select at least one seat');
  const ids = [...new Set(seats.map((s) => String(s).toUpperCase().trim()))];
  if (ids.length > config.maxSeatsPerBooking) {
    throw badRequest(`You can book at most ${config.maxSeatsPerBooking} seats at a time`);
  }
  if (ids.some((id) => !/^[A-Z]\d{1,2}$/.test(id))) throw badRequest('Invalid seat id');
  return ids;
}

/** Seats nobody else can take right now: sold seats + other people's live holds. */
export function unavailableSeats(showId, userId = null) {
  const booked = db.prepare('SELECT seat_id FROM booked_seats WHERE show_id = ?').all(showId).map((r) => r.seat_id);
  const held = db
    .prepare('SELECT seat_id, user_id, expires_at FROM seat_holds WHERE show_id = ? AND expires_at > ?')
    .all(showId, Date.now());
  return {
    booked,
    heldByOthers: held.filter((h) => h.user_id !== userId).map((h) => h.seat_id),
    mine: held.filter((h) => h.user_id === userId),
  };
}

export function newBookingCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let code = 'CV';
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return code;
}

export const BOOKING_SELECT = `
  SELECT b.*, s.starts_at, s.language, s.format, sc.name AS screen_name,
         t.name AS theatre_name, t.address AS theatre_address, c.name AS city_name,
         m.id AS movie_id, m.title AS movie_title, m.poster_url, m.certificate, m.duration_min,
         u.name AS user_name, u.email AS user_email
  FROM bookings b
  JOIN shows s ON s.id = b.show_id
  JOIN screens sc ON sc.id = s.screen_id
  JOIN theatres t ON t.id = sc.theatre_id
  JOIN cities c ON c.id = t.city_id
  JOIN movies m ON m.id = s.movie_id
  JOIN users u ON u.id = b.user_id`;
