import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seedIfEmpty } from '../src/seed.js';

const SECRET = 'test-secret';
const future = (hours = 24) => new Date(Date.now() + hours * 3600_000).toISOString();

let app;
let db;

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.token;
}

async function setup() {
  db = createDb(':memory:');
  await seedIfEmpty(db);
  app = createApp({ db, jwtSecret: SECRET, loginRateLimit: { max: Infinity } });
  const adminToken = await login('admin@reelseat.com', 'Admin@123');
  const userToken = await login('user@reelseat.com', 'User@1234');
  const reg = await request(app).post('/api/auth/register')
    .send({ name: 'Other', email: 'other@example.com', password: 'password123' });
  return { adminToken, userToken, otherToken: reg.body.token };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('auth', () => {
  let t;
  beforeEach(async () => { t = await setup(); });

  it('logs in with role in the response', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'ADMIN@reelseat.com', password: 'Admin@123' });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'admin');
    assert.ok(res.body.token);
    assert.equal(res.body.user.password_hash, undefined);
  });

  it('rejects bad credentials with a generic message', async () => {
    const wrongPw = await request(app).post('/api/auth/login').send({ email: 'admin@reelseat.com', password: 'nope' });
    const noUser = await request(app).post('/api/auth/login').send({ email: 'ghost@x.com', password: 'nope' });
    assert.equal(wrongPw.status, 401);
    assert.equal(noUser.status, 401);
    assert.equal(wrongPw.body.error, noUser.body.error);
  });

  it('registers regular users only, even if role is supplied', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'Eve', email: 'eve@example.com', password: 'password123', role: 'admin' });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'user');
  });

  it('rejects duplicate email and invalid input', async () => {
    const dup = await request(app).post('/api/auth/register')
      .send({ name: 'Dup', email: 'user@reelseat.com', password: 'password123' });
    assert.equal(dup.status, 409);
    const bad = await request(app).post('/api/auth/register').send({ name: 'X', email: 'not-an-email', password: '1' });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.details.email);
    assert.ok(bad.body.details.password);
  });

  it('requires a valid bearer token on protected routes', async () => {
    assert.equal((await request(app).get('/api/movies')).status, 401);
    assert.equal((await request(app).get('/api/movies').set(auth('garbage'))).status, 401);
    const forged = jwt.sign({ sub: '1', role: 'admin' }, 'wrong-secret');
    assert.equal((await request(app).get('/api/movies').set(auth(forged))).status, 401);
    const expired = jwt.sign({ sub: '1', role: 'admin' }, SECRET, { expiresIn: -10 });
    assert.equal((await request(app).get('/api/movies').set(auth(expired))).status, 401);
    const me = await request(app).get('/api/auth/me').set(auth(t.userToken));
    assert.equal(me.body.user.email, 'user@reelseat.com');
  });

  it('rate limits login attempts', async () => {
    const limited = createApp({ db, jwtSecret: SECRET, loginRateLimit: { max: 2, windowMs: 60_000 } });
    for (let i = 0; i < 2; i++) {
      await request(limited).post('/api/auth/login').send({ email: 'a@b.co', password: 'x' });
    }
    const res = await request(limited).post('/api/auth/login').send({ email: 'a@b.co', password: 'x' });
    assert.equal(res.status, 429);
  });
});

describe('admin catalogue management', () => {
  let t;
  beforeEach(async () => { t = await setup(); });

  it('forbids non-admins from writes', async () => {
    const r1 = await request(app).post('/api/movies').set(auth(t.userToken)).send({ title: 'X', duration_min: 90 });
    const r2 = await request(app).delete('/api/theatres/1').set(auth(t.userToken));
    const r3 = await request(app).post('/api/shows').set(auth(t.userToken)).send({});
    assert.deepEqual([r1.status, r2.status, r3.status], [403, 403, 403]);
  });

  it('creates and deletes movies, theatres and shows', async () => {
    const movie = await request(app).post('/api/movies').set(auth(t.adminToken))
      .send({ title: 'Test Movie', duration_min: 100, genre: 'Drama', poster_url: 'https://example.com/p.jpg' });
    assert.equal(movie.status, 201);
    const theatre = await request(app).post('/api/theatres').set(auth(t.adminToken))
      .send({ name: 'Test Hall', seat_rows: 5, seat_cols: 8 });
    assert.equal(theatre.status, 201);
    const show = await request(app).post('/api/shows').set(auth(t.adminToken))
      .send({ movie_id: movie.body.id, theatre_id: theatre.body.id, start_time: future(), price: 150 });
    assert.equal(show.status, 201);
    assert.equal(show.body.movie_title, 'Test Movie');

    const details = await request(app).get(`/api/movies/${movie.body.id}`).set(auth(t.userToken));
    assert.equal(details.body.shows.length, 1);

    assert.equal((await request(app).delete(`/api/movies/${movie.body.id}`).set(auth(t.adminToken))).status, 204);
    // cascade removed the show
    assert.equal((await request(app).get(`/api/shows/${show.body.id}`).set(auth(t.adminToken))).status, 404);
    assert.equal((await request(app).delete(`/api/theatres/${theatre.body.id}`).set(auth(t.adminToken))).status, 204);
    assert.equal((await request(app).delete(`/api/theatres/${theatre.body.id}`).set(auth(t.adminToken))).status, 404);
  });

  it('validates catalogue input', async () => {
    const m = await request(app).post('/api/movies').set(auth(t.adminToken))
      .send({ title: '', duration_min: -1, poster_url: 'javascript:alert(1)' });
    assert.equal(m.status, 400);
    assert.ok(m.body.details.title && m.body.details.duration_min && m.body.details.poster_url);
    const th = await request(app).post('/api/theatres').set(auth(t.adminToken))
      .send({ name: 'Big', seat_rows: 40, seat_cols: 10 });
    assert.equal(th.status, 400);
    const past = await request(app).post('/api/shows').set(auth(t.adminToken))
      .send({ movie_id: 1, theatre_id: 1, start_time: '2000-01-01T10:00:00Z', price: 100 });
    assert.equal(past.status, 400);
    const missing = await request(app).post('/api/shows').set(auth(t.adminToken))
      .send({ movie_id: 999, theatre_id: 1, start_time: future(), price: 100 });
    assert.equal(missing.status, 400);
  });
});

describe('movies listing', () => {
  let t;
  beforeEach(async () => { t = await setup(); });

  it('lists and filters movies', async () => {
    const all = await request(app).get('/api/movies').set(auth(t.userToken));
    assert.equal(all.status, 200);
    assert.equal(all.body.length, 6);
    const q = await request(app).get('/api/movies?q=orbit').set(auth(t.userToken));
    assert.deepEqual(q.body.map((m) => m.title), ['Orbitfall']);
    const genre = await request(app).get('/api/movies?genre=comedy').set(auth(t.userToken));
    assert.equal(genre.body.length, 1);
  });

  it('returns 404 / 400 for unknown or invalid ids', async () => {
    assert.equal((await request(app).get('/api/movies/9999').set(auth(t.userToken))).status, 404);
    assert.equal((await request(app).get('/api/movies/abc').set(auth(t.userToken))).status, 400);
  });
});

describe('bookings', () => {
  let t;
  let showId;
  beforeEach(async () => {
    t = await setup();
    showId = db.prepare('SELECT id FROM shows ORDER BY id LIMIT 1').get().id;
  });

  const book = (token, seats, id = showId) =>
    request(app).post('/api/bookings').set(auth(token)).send({ showId: id, seats });

  it('creates a booking and marks seats as booked', async () => {
    const res = await book(t.userToken, ['a2', 'A1']);
    assert.equal(res.status, 201);
    assert.deepEqual(res.body.seats, ['A1', 'A2']);
    const price = db.prepare('SELECT price FROM shows WHERE id = ?').get(showId).price;
    assert.equal(res.body.total_amount, price * 2);

    const show = await request(app).get(`/api/shows/${showId}`).set(auth(t.otherToken));
    assert.deepEqual(show.body.booked_seats.sort(), ['A1', 'A2']);
    assert.deepEqual(show.body.my_seats, []);
  });

  it('prevents double booking', async () => {
    assert.equal((await book(t.userToken, ['B5'])).status, 201);
    const clash = await book(t.otherToken, ['B4', 'B5']);
    assert.equal(clash.status, 409);
    assert.deepEqual(clash.body.details.conflicts, ['B5']);
    // nothing partially written
    const show = await request(app).get(`/api/shows/${showId}`).set(auth(t.otherToken));
    assert.deepEqual(show.body.booked_seats, ['B5']);
  });

  it('rejects invalid seats, duplicates, empty and oversize requests', async () => {
    assert.equal((await book(t.userToken, ['Z99'])).status, 400);
    assert.equal((await book(t.userToken, ['A1', 'A1'])).status, 400);
    assert.equal((await book(t.userToken, [])).status, 400);
    const eleven = Array.from({ length: 11 }, (_, i) => `C${i + 1}`);
    assert.equal((await book(t.userToken, eleven)).status, 400);
    assert.equal((await book(t.userToken, ['A1'], 99999)).status, 404);
  });

  it('rejects booking a show that already started', async () => {
    db.prepare('UPDATE shows SET start_time = ? WHERE id = ?').run('2000-01-01T00:00:00.000Z', showId);
    assert.equal((await book(t.userToken, ['A1'])).status, 400);
  });

  it('lists only own bookings for users and all bookings for admins', async () => {
    await book(t.userToken, ['A1']);
    await book(t.otherToken, ['A2']);
    const mine = await request(app).get('/api/bookings').set(auth(t.userToken));
    assert.equal(mine.body.length, 1);
    assert.deepEqual(mine.body[0].seats, ['A1']);
    const all = await request(app).get('/api/bookings').set(auth(t.adminToken));
    assert.equal(all.body.length, 2);
  });

  it('edits seats of own booking, allowing reuse of its existing seats', async () => {
    const created = await book(t.userToken, ['D1', 'D2']);
    await book(t.otherToken, ['D5']);
    const upd = await request(app).put(`/api/bookings/${created.body.id}`).set(auth(t.userToken))
      .send({ seats: ['D2', 'D3', 'D4'] });
    assert.equal(upd.status, 200);
    assert.deepEqual(upd.body.seats, ['D2', 'D3', 'D4']);
    const clash = await request(app).put(`/api/bookings/${created.body.id}`).set(auth(t.userToken))
      .send({ seats: ['D5'] });
    assert.equal(clash.status, 409);
    const after = await request(app).get(`/api/bookings/${created.body.id}`).set(auth(t.userToken));
    assert.deepEqual(after.body.seats, ['D2', 'D3', 'D4']);
  });

  it("does not allow access to other users' bookings", async () => {
    const created = await book(t.userToken, ['E1']);
    const id = created.body.id;
    assert.equal((await request(app).get(`/api/bookings/${id}`).set(auth(t.otherToken))).status, 404);
    assert.equal((await request(app).put(`/api/bookings/${id}`).set(auth(t.otherToken)).send({ seats: ['E2'] })).status, 404);
    assert.equal((await request(app).delete(`/api/bookings/${id}`).set(auth(t.otherToken))).status, 404);
  });

  it('cancels a booking and frees its seats', async () => {
    const created = await book(t.userToken, ['F1']);
    assert.equal((await request(app).delete(`/api/bookings/${created.body.id}`).set(auth(t.userToken))).status, 204);
    assert.equal((await book(t.otherToken, ['F1'])).status, 201);
  });

  it('lets admins cancel any booking', async () => {
    const created = await book(t.userToken, ['G1']);
    assert.equal((await request(app).delete(`/api/bookings/${created.body.id}`).set(auth(t.adminToken))).status, 204);
  });
});

describe('robustness', () => {
  it('handles malformed JSON and unknown endpoints', async () => {
    await setup();
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
    assert.equal(bad.status, 400);
    assert.equal((await request(app).get('/api/nope')).status, 404);
  });
});
