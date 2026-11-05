import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'Basic' CHECK (plan IN ('Basic','Premium')),
  plan_expires  TEXT,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  city_id       INTEGER REFERENCES cities(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cities (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE,
  slug  TEXT NOT NULL UNIQUE,
  state TEXT
);

CREATE TABLE IF NOT EXISTS theatres (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id   INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  brand     TEXT NOT NULL,
  address   TEXT,
  amenities TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS screens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  theatre_id INTEGER NOT NULL REFERENCES theatres(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  format     TEXT NOT NULL DEFAULT '2D',
  layout     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS movies (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  genres       TEXT NOT NULL DEFAULT '[]',
  languages    TEXT NOT NULL DEFAULT '[]',
  duration_min INTEGER NOT NULL DEFAULT 120,
  certificate  TEXT NOT NULL DEFAULT 'UA',
  release_date TEXT,
  description  TEXT,
  director     TEXT,
  cast_list    TEXT NOT NULL DEFAULT '[]',
  poster_url   TEXT,
  backdrop_url TEXT,
  trailer_url  TEXT,
  status       TEXT NOT NULL DEFAULT 'now_showing' CHECK (status IN ('now_showing','coming_soon','archived')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shows (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_id   INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  screen_id  INTEGER NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  starts_at  TEXT NOT NULL,           -- local time, 'YYYY-MM-DDTHH:MM'
  language   TEXT NOT NULL,
  format     TEXT NOT NULL DEFAULT '2D',
  price_factor REAL NOT NULL DEFAULT 1.0,
  UNIQUE (screen_id, starts_at)
);
CREATE INDEX IF NOT EXISTS idx_shows_movie ON shows(movie_id, starts_at);

CREATE TABLE IF NOT EXISTS seat_holds (
  show_id    INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  seat_id    TEXT NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,        -- epoch ms
  PRIMARY KEY (show_id, seat_id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT NOT NULL UNIQUE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  show_id         INTEGER NOT NULL REFERENCES shows(id),
  seats           TEXT NOT NULL,      -- JSON [{id, category, price}]
  food            TEXT NOT NULL DEFAULT '[]',
  ticket_amount   REAL NOT NULL,
  food_amount     REAL NOT NULL DEFAULT 0,
  convenience_fee REAL NOT NULL DEFAULT 0,
  discount        REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL,
  coupon_code     TEXT,
  payment_method  TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED','CANCELLED')),
  refund_amount   REAL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  cancelled_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, created_at);

-- One row per sold seat; the primary key is what makes double booking impossible.
CREATE TABLE IF NOT EXISTS booked_seats (
  show_id    INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  seat_id    TEXT NOT NULL,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  PRIMARY KEY (show_id, seat_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_id   INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 10),
  comment    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (movie_id, user_id)
);

CREATE TABLE IF NOT EXISTS coupons (
  code         TEXT PRIMARY KEY COLLATE NOCASE,
  description  TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('PERCENT','FLAT')),
  value        REAL NOT NULL,
  max_discount REAL,
  min_amount   REAL NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS food_items (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT NOT NULL,
  category TEXT NOT NULL,
  price    REAL NOT NULL,
  emoji    TEXT,
  veg      INTEGER NOT NULL DEFAULT 1
);
`;

export function openDb(file = config.dbFile) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

export const db = openDb(config.isTest ? ':memory:' : config.dbFile);

/** Parse JSON columns on a row. */
export function parseJson(row, ...cols) {
  if (!row) return row;
  for (const c of cols) {
    if (typeof row[c] === 'string') {
      try { row[c] = JSON.parse(row[c]); } catch { /* leave as is */ }
    }
  }
  return row;
}
