process.env.NODE_ENV = 'test';

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

const { db, openDb } = await import('../src/db.js');
const { seed } = await import('../src/seed.js');
const { createApp } = await import('../src/app.js');
const { config, resolveJwtSecret } = await import('../src/config.js');

const app = createApp();
// Each agent keeps its own cookie jar, i.e. behaves like one signed-in browser.
const riya = request.agent(app);
const kabir = request.agent(app);
const admin = request.agent(app);
let showId;
let seatIds;

before(() => {
  seed(db, { reset: true });
});

test('health check', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

test('production refuses to boot without a real JWT secret', () => {
  assert.throws(() => resolveJwtSecret({ NODE_ENV: 'production' }), /JWT_SECRET/);
  assert.throws(() => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: '   ' }), /JWT_SECRET/);
  assert.throws(() => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'cineverse-dev-secret-change-me' }), /JWT_SECRET/);
  assert.throws(() => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'change-me-to-a-long-random-string' }), /JWT_SECRET/);
  assert.equal(resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'a-real-long-random-secret' }), 'a-real-long-random-secret');
  // Development keeps working out of the box
  assert.equal(resolveJwtSecret({}), 'cineverse-dev-secret-change-me');
});

test('demo accounts are only seeded outside production', () => {
  const emails = (d) => d.prepare('SELECT email FROM users ORDER BY id').all().map((u) => u.email);
  assert.deepEqual(emails(db), ['admin@cineverse.com', 'demo@cineverse.com']);

  const prodDb = openDb(':memory:');
  try {
    seed(prodDb, { demoAccounts: false });
    assert.deepEqual(emails(prodDb), []);
    assert.equal(prodDb.prepare('SELECT COUNT(*) AS n FROM reviews').get().n, 0);
    assert.ok(prodDb.prepare('SELECT COUNT(*) AS n FROM movies').get().n > 0, 'the catalogue is still seeded');
  } finally {
    prodDb.close();
  }
});

test('registration enforces password strength', async () => {
  const attempt = (password) => request(app).post('/api/auth/register')
    .send({ name: 'Weak', email: 'weak@test.com', password });
  for (const password of ['short1', 'abcdefghij', '1234567890']) {
    const res = await attempt(password);
    assert.equal(res.status, 400, `"${password}" should be rejected`);
    assert.match(res.body.error, /Password must/);
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE email = 'weak@test.com'").get().n, 0);
});

test('register + login + me use an httpOnly session cookie', async () => {
  const reg = await request(app).post('/api/auth/register')
    .send({ name: 'Riya', email: 'riya@test.com', password: 'secret123' });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.token, undefined, 'the token must not be exposed to page scripts');
  assert.equal(reg.body.user.password_hash, undefined);
  const cookie = reg.headers['set-cookie'].find((c) => c.startsWith(`${config.authCookieName}=`));
  assert.ok(cookie, 'expected a session cookie');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Expires=/i);

  const dup = await request(app).post('/api/auth/register')
    .send({ name: 'Riya', email: 'RIYA@test.com', password: 'secret123' });
  assert.equal(dup.status, 409);

  const bad = await riya.post('/api/auth/login').send({ email: 'riya@test.com', password: 'nope' });
  assert.equal(bad.status, 401);
  assert.equal(bad.headers['set-cookie'], undefined);

  const login = await riya.post('/api/auth/login').send({ email: 'riya@test.com', password: 'secret123' });
  assert.equal(login.status, 200);
  assert.equal(login.body.token, undefined);

  const me = await riya.get('/api/auth/me');
  assert.equal(me.body.user.email, 'riya@test.com');

  // No cookie, a forged cookie, or a Bearer header are all anonymous
  assert.equal((await request(app).get('/api/auth/me')).status, 401);
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', `${config.authCookieName}=not-a-jwt`)).status, 401);
  const token = cookie.split(';')[0].split('=')[1];
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status, 401);

  const other = await kabir.post('/api/auth/register')
    .send({ name: 'Kabir', email: 'kabir@test.com', password: 'secret456' });
  assert.equal(other.status, 201);
});

test('logout clears the session cookie', async () => {
  const browser = request.agent(app);
  await browser.post('/api/auth/login').send({ email: 'demo@cineverse.com', password: 'demo123' });
  assert.equal((await browser.get('/api/auth/me')).status, 200);
  const out = await browser.post('/api/auth/logout');
  assert.equal(out.status, 200);
  assert.equal((await browser.get('/api/auth/me')).status, 401);
});

test('CORS allows credentials only for the configured origin', async () => {
  const ok = await request(app).get('/api/health').set('Origin', config.clientOrigin);
  assert.equal(ok.headers['access-control-allow-origin'], config.clientOrigin);
  assert.equal(ok.headers['access-control-allow-credentials'], 'true');

  const evil = await request(app).get('/api/health').set('Origin', 'https://evil.example');
  assert.equal(evil.headers['access-control-allow-origin'], undefined);
});

test('changing password enforces the same strength rules', async () => {
  const weak = await kabir.post('/api/users/me/password').send({ currentPassword: 'secret456', newPassword: 'short' });
  assert.equal(weak.status, 400);
  const ok = await kabir.post('/api/users/me/password').send({ currentPassword: 'secret456', newPassword: 'secret789' });
  assert.equal(ok.status, 200);
});

test('movie catalogue with filters', async () => {
  const all = await request(app).get('/api/movies?city=mumbai');
  assert.equal(all.status, 200);
  assert.ok(all.body.movies.length > 0);

  const horror = await request(app).get('/api/movies?genre=Horror');
  assert.ok(horror.body.movies.every((m) => m.genres.includes('Horror')));

  const search = await request(app).get('/api/movies?q=nolan');
  assert.ok(search.body.movies.some((m) => m.title === 'Interstellar'));

  const detail = await request(app).get('/api/movies/interstellar');
  assert.equal(detail.body.movie.title, 'Interstellar');
});

test('showtimes for a movie are grouped by theatre', async () => {
  // Pick the first movie that still has a show in Mumbai today/tomorrow
  const movies = (await request(app).get('/api/movies?city=mumbai')).body.movies;
  let found;
  for (const m of movies) {
    const res = await request(app).get(`/api/movies/${m.id}/shows?city=mumbai`);
    const date = res.body.dates[0];
    const day = await request(app).get(`/api/movies/${m.id}/shows?city=mumbai&date=${date}`);
    if (day.body.theatres.length) { found = day.body; break; }
  }
  assert.ok(found, 'expected at least one show');
  showId = found.theatres[0].shows[0].id;
});

test('seat holds prevent double booking', async () => {
  const show = await request(app).get(`/api/shows/${showId}`);
  assert.equal(show.status, 200);
  const firstCat = show.body.show.layout.categories.at(-1);
  seatIds = [`${firstCat.rows[0]}1`, `${firstCat.rows[0]}2`];

  const unauth = await request(app).post(`/api/shows/${showId}/hold`).send({ seats: seatIds });
  assert.equal(unauth.status, 401);

  const hold = await riya.post(`/api/shows/${showId}/hold`).send({ seats: seatIds });
  assert.equal(hold.status, 200);

  const clash = await kabir.post(`/api/shows/${showId}/hold`).send({ seats: [seatIds[1]] });
  assert.equal(clash.status, 409);

  const view = await kabir.get(`/api/shows/${showId}`);
  assert.ok(seatIds.every((s) => view.body.unavailable.includes(s)));

  const bogus = await riya.post(`/api/shows/${showId}/hold`).send({ seats: ['Z99'] });
  assert.equal(bogus.status, 400);
});

test('preview and confirm booking with coupon + food', async () => {
  // Re-hold (the bogus request above didn't touch the previous hold)
  await riya.post(`/api/shows/${showId}/hold`).send({ seats: seatIds });

  const preview = await riya.post('/api/bookings/preview')
    .send({ showId, seats: seatIds, food: [{ id: 1, qty: 2 }], coupon: 'STUDENT20' });
  assert.equal(preview.status, 200);
  const q = preview.body.quote;
  assert.equal(q.foodAmount, 440);
  assert.ok(q.couponDiscount > 0);
  assert.equal(q.total, Math.round((q.ticketAmount + q.foodAmount + q.convenienceFee - q.discount) * 100) / 100);

  const badCoupon = await riya.post('/api/bookings/preview').send({ showId, seats: seatIds, coupon: 'NOPE' });
  assert.equal(badCoupon.status, 400);

  const noPay = await riya.post('/api/bookings').send({ showId, seats: seatIds });
  assert.equal(noPay.status, 400);

  const booked = await riya.post('/api/bookings')
    .send({ showId, seats: seatIds, food: [{ id: 1, qty: 2 }], coupon: 'STUDENT20', paymentMethod: 'UPI' });
  assert.equal(booked.status, 201);
  assert.match(booked.body.booking.code, /^CV[A-Z0-9]{8}$/);
  assert.equal(booked.body.booking.total, q.total);

  // Kabir cannot grab those seats any more
  const steal = await kabir.post(`/api/shows/${showId}/hold`).send({ seats: seatIds });
  assert.equal(steal.status, 409);

  // ...and cannot read Riya's booking
  const peek = await kabir.get(`/api/bookings/${booked.body.booking.code}`);
  assert.equal(peek.status, 403);

  const mine = await riya.get('/api/bookings');
  assert.equal(mine.body.bookings.length, 1);
});

test('booking without a hold is rejected', async () => {
  const res = await kabir.post('/api/bookings').send({ showId, seats: ['A5'], paymentMethod: 'CARD' });
  assert.equal(res.status, 409);
});

test('premium membership removes fees and gives 10% off', async () => {
  const up = await kabir.post('/api/users/me/membership');
  assert.equal(up.body.user.plan, 'Premium');
  const preview = await kabir.post('/api/bookings/preview').send({ showId, seats: ['A7'] });
  const q = preview.body.quote;
  assert.equal(q.convenienceFee, 0);
  assert.equal(q.membershipDiscount, Math.round(q.ticketAmount * 0.1 * 100) / 100);
});

test('reviews update the movie rating', async () => {
  const res = await riya.post('/api/movies/1/reviews').send({ rating: 7, comment: 'Nice' });
  assert.equal(res.status, 201);
  assert.equal(res.body.movie.votes, 2);
  const again = await riya.post('/api/movies/1/reviews').send({ rating: 11 });
  assert.equal(again.status, 400);
});

test('admin endpoints are protected', async () => {
  const denied = await riya.get('/api/admin/stats');
  assert.equal(denied.status, 403);

  // The dev/demo admin login keeps working
  const login = await admin.post('/api/auth/login').send({ email: 'admin@cineverse.com', password: 'admin123' });
  assert.equal(login.status, 200);
  const stats = await admin.get('/api/admin/stats');
  assert.equal(stats.status, 200);
  assert.equal(stats.body.totals.bookings, 1);

  const movie = await admin.post('/api/admin/movies')
    .send({ title: 'Test Movie', genres: 'Drama, Comedy', languages: 'Hindi', duration_min: 100, status: 'coming_soon' });
  assert.equal(movie.status, 201);
  assert.deepEqual(movie.body.movie.genres, ['Drama', 'Comedy']);
});

test('live seat stream pushes an event when seats change', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const ctrl = new AbortController();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/shows/${showId}/stream`, { signal: ctrl.signal });
    assert.equal(res.headers.get('content-type'), 'text/event-stream');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = decoder.decode((await reader.read()).value); // "retry: ..." preamble

    await riya.post(`/api/shows/${showId}/hold`).send({ seats: ['B3'] });
    while (!text.includes('event: seats')) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += decoder.decode(chunk.value);
    }
    assert.match(text, /event: seats/);
  } finally {
    ctrl.abort();
    server.closeAllConnections();
    server.close();
  }
});

test('featured film leads the catalogue and plays in every premium format', async () => {
  const list = await request(app).get('/api/movies?city=mumbai');
  assert.equal(list.body.movies[0].title, 'Ramayana: Rise of a Legend');
  assert.equal(list.body.movies[0].featured, true);

  const detail = await request(app).get('/api/movies/ramayana-rise-of-a-legend?city=mumbai');
  const formats = detail.body.movie.formats.map((f) => f.name);
  for (const f of ['IMAX 3D', '4DX 3D', 'ScreenX', 'P[XL]', 'ICE', 'Dolby Cinema']) {
    assert.ok(formats.some((x) => x.startsWith(f.split(' ')[0])), `expected a ${f} show, got ${formats.join(', ')}`);
  }
  assert.ok(formats.includes('IMAX 3D'));

  const next = await request(app).get('/api/movies/ramayana-rise-of-a-legend/next-show?city=mumbai');
  assert.equal(next.status, 200);
  assert.match(next.body.show.format, /IMAX/);

  const filtered = await request(app).get(`/api/movies/ramayana-rise-of-a-legend/shows?city=mumbai&format=${encodeURIComponent('IMAX 3D')}`);
  assert.ok(filtered.body.formats.includes('IMAX 3D'));
  assert.ok(filtered.body.theatres.every((t) => t.shows.every((s) => s.format === 'IMAX 3D')));
});

// Keep this last: it deliberately exhausts the per-user limits.
test('seat holds and bookings are rate limited per user', async () => {
  const saved = { ...config.rateLimits };
  config.rateLimits.hold = 1;
  config.rateLimits.booking = 1;
  try {
    const limitedHold = await riya.post(`/api/shows/${showId}/hold`).send({ seats: ['B3'] });
    assert.equal(limitedHold.status, 429);
    assert.match(limitedHold.body.error, /too quickly/);

    const limitedBooking = await riya.post('/api/bookings').send({ showId, seats: ['B3'], paymentMethod: 'UPI' });
    assert.equal(limitedBooking.status, 429);

    // Limits are per account: the admin has not held or booked anything yet
    const adminHold = await admin.post(`/api/shows/${showId}/hold`).send({ seats: ['B4'] });
    assert.equal(adminHold.status, 200);
    // Reading and previewing are not throttled
    assert.equal((await riya.post('/api/bookings/preview').send({ showId, seats: ['B3'] })).status, 200);
  } finally {
    Object.assign(config.rateLimits, saved);
  }
});
