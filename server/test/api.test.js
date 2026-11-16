process.env.NODE_ENV = 'test';

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

const { db } = await import('../src/db.js');
const { seed } = await import('../src/seed.js');
const { createApp } = await import('../src/app.js');

const app = createApp();
let token;
let token2;
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

test('register + login + me', async () => {
  const reg = await request(app).post('/api/auth/register')
    .send({ name: 'Riya', email: 'riya@test.com', password: 'secret1' });
  assert.equal(reg.status, 201);
  assert.ok(reg.body.token);
  assert.equal(reg.body.user.password_hash, undefined);

  const dup = await request(app).post('/api/auth/register')
    .send({ name: 'Riya', email: 'RIYA@test.com', password: 'secret1' });
  assert.equal(dup.status, 409);

  const bad = await request(app).post('/api/auth/login').send({ email: 'riya@test.com', password: 'nope' });
  assert.equal(bad.status, 401);

  const login = await request(app).post('/api/auth/login').send({ email: 'riya@test.com', password: 'secret1' });
  assert.equal(login.status, 200);
  token = login.body.token;

  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.equal(me.body.user.email, 'riya@test.com');

  const other = await request(app).post('/api/auth/register')
    .send({ name: 'Kabir', email: 'kabir@test.com', password: 'secret2' });
  token2 = other.body.token;
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

  const hold = await request(app).post(`/api/shows/${showId}/hold`)
    .set('Authorization', `Bearer ${token}`).send({ seats: seatIds });
  assert.equal(hold.status, 200);

  const clash = await request(app).post(`/api/shows/${showId}/hold`)
    .set('Authorization', `Bearer ${token2}`).send({ seats: [seatIds[1]] });
  assert.equal(clash.status, 409);

  const view = await request(app).get(`/api/shows/${showId}`).set('Authorization', `Bearer ${token2}`);
  assert.ok(seatIds.every((s) => view.body.unavailable.includes(s)));

  const bogus = await request(app).post(`/api/shows/${showId}/hold`)
    .set('Authorization', `Bearer ${token}`).send({ seats: ['Z99'] });
  assert.equal(bogus.status, 400);
});

test('preview and confirm booking with coupon + food', async () => {
  // Re-hold (the bogus request above didn't touch the previous hold)
  await request(app).post(`/api/shows/${showId}/hold`).set('Authorization', `Bearer ${token}`).send({ seats: seatIds });

  const preview = await request(app).post('/api/bookings/preview').set('Authorization', `Bearer ${token}`)
    .send({ showId, seats: seatIds, food: [{ id: 1, qty: 2 }], coupon: 'STUDENT20' });
  assert.equal(preview.status, 200);
  const q = preview.body.quote;
  assert.equal(q.foodAmount, 440);
  assert.ok(q.couponDiscount > 0);
  assert.equal(q.total, Math.round((q.ticketAmount + q.foodAmount + q.convenienceFee - q.discount) * 100) / 100);

  const badCoupon = await request(app).post('/api/bookings/preview').set('Authorization', `Bearer ${token}`)
    .send({ showId, seats: seatIds, coupon: 'NOPE' });
  assert.equal(badCoupon.status, 400);

  const noPay = await request(app).post('/api/bookings').set('Authorization', `Bearer ${token}`)
    .send({ showId, seats: seatIds });
  assert.equal(noPay.status, 400);

  const booked = await request(app).post('/api/bookings').set('Authorization', `Bearer ${token}`)
    .send({ showId, seats: seatIds, food: [{ id: 1, qty: 2 }], coupon: 'STUDENT20', paymentMethod: 'UPI' });
  assert.equal(booked.status, 201);
  assert.match(booked.body.booking.code, /^CV[A-Z0-9]{8}$/);
  assert.equal(booked.body.booking.total, q.total);

  // Kabir cannot grab those seats any more
  const steal = await request(app).post(`/api/shows/${showId}/hold`)
    .set('Authorization', `Bearer ${token2}`).send({ seats: seatIds });
  assert.equal(steal.status, 409);

  // ...and cannot read Riya's booking
  const peek = await request(app).get(`/api/bookings/${booked.body.booking.code}`).set('Authorization', `Bearer ${token2}`);
  assert.equal(peek.status, 403);

  const mine = await request(app).get('/api/bookings').set('Authorization', `Bearer ${token}`);
  assert.equal(mine.body.bookings.length, 1);
});

test('booking without a hold is rejected', async () => {
  const res = await request(app).post('/api/bookings').set('Authorization', `Bearer ${token2}`)
    .send({ showId, seats: ['A5'], paymentMethod: 'CARD' });
  assert.equal(res.status, 409);
});

test('premium membership removes fees and gives 10% off', async () => {
  const up = await request(app).post('/api/users/me/membership').set('Authorization', `Bearer ${token2}`);
  assert.equal(up.body.user.plan, 'Premium');
  const preview = await request(app).post('/api/bookings/preview').set('Authorization', `Bearer ${token2}`)
    .send({ showId, seats: ['A7'] });
  const q = preview.body.quote;
  assert.equal(q.convenienceFee, 0);
  assert.equal(q.membershipDiscount, Math.round(q.ticketAmount * 0.1 * 100) / 100);
});

test('reviews update the movie rating', async () => {
  const res = await request(app).post('/api/movies/1/reviews').set('Authorization', `Bearer ${token}`)
    .send({ rating: 7, comment: 'Nice' });
  assert.equal(res.status, 201);
  assert.equal(res.body.movie.votes, 2);
  const again = await request(app).post('/api/movies/1/reviews').set('Authorization', `Bearer ${token}`)
    .send({ rating: 11 });
  assert.equal(again.status, 400);
});

test('admin endpoints are protected', async () => {
  const denied = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`);
  assert.equal(denied.status, 403);

  const login = await request(app).post('/api/auth/login').send({ email: 'admin@cineverse.com', password: 'admin123' });
  const admin = login.body.token;
  const stats = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${admin}`);
  assert.equal(stats.status, 200);
  assert.equal(stats.body.totals.bookings, 1);

  const movie = await request(app).post('/api/admin/movies').set('Authorization', `Bearer ${admin}`)
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

    await request(app).post(`/api/shows/${showId}/hold`).set('Authorization', `Bearer ${token}`).send({ seats: ['B3'] });
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
