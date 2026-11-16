import { parseJson } from '../db.js';

export function formatMovie(row) {
  if (!row) return row;
  parseJson(row, 'genres', 'languages', 'cast_list');
  const { cast_list, ...rest } = row;
  return {
    ...rest,
    cast: cast_list,
    featured: Boolean(row.featured),
    has_3d: Boolean(row.has_3d),
    rating: row.rating != null ? Number(Number(row.rating).toFixed(1)) : null,
    votes: row.votes ?? 0,
  };
}

export function formatTheatre(row) {
  return parseJson(row, 'amenities');
}

export function formatBooking(row) {
  if (!row) return row;
  parseJson(row, 'seats', 'food');
  return row;
}

export const MOVIE_SELECT = `
  SELECT m.*, r.rating, COALESCE(r.votes, 0) AS votes
  FROM movies m
  LEFT JOIN (SELECT movie_id, AVG(rating) AS rating, COUNT(*) AS votes FROM reviews GROUP BY movie_id) r
    ON r.movie_id = m.id`;
