import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { transaction } from './db.js';

const MOVIES = [
  { title: 'Monsoon Protocol', genre: 'Action, Thriller', language: 'English', duration_min: 142, rating: 'UA',
    description: 'A rookie coast-guard officer uncovers a smuggling ring during the worst storm in a century.' },
  { title: 'The Clockmaker of Mysuru', genre: 'Drama, Fantasy', language: 'Kannada', duration_min: 128, rating: 'U',
    description: 'An old craftsman builds a clock that can rewind a single hour - and the whole town wants a turn.' },
  { title: 'Orbitfall', genre: 'Sci-Fi, Adventure', language: 'English', duration_min: 155, rating: 'UA',
    description: 'Stranded on a decaying space station, five strangers must cooperate to make it home.' },
  { title: 'Chai & Chaos', genre: 'Comedy, Romance', language: 'Hindi', duration_min: 118, rating: 'U',
    description: 'Two rival tea-stall owners on the same street fall for each other during a city festival.' },
  { title: 'Silent Frequencies', genre: 'Horror, Mystery', language: 'English', duration_min: 104, rating: 'A',
    description: 'A late-night radio host starts receiving calls from listeners who vanished years ago.' },
  { title: 'Kaveri Rising', genre: 'Drama, Sports', language: 'Tamil', duration_min: 137, rating: 'U',
    description: 'A village kabaddi team fights its way to the national championship against all odds.' },
];

const THEATRES = [
  { name: 'Galaxy Multiplex - Screen 1', location: 'MG Road, Bengaluru', seat_rows: 8, seat_cols: 12 },
  { name: 'Lakeside Cinemas', location: 'Whitefield, Bengaluru', seat_rows: 10, seat_cols: 14 },
  { name: 'Heritage Talkies', location: 'Jayanagar, Bengaluru', seat_rows: 6, seat_cols: 10 },
];

function futureSlot(dayOffset, hour) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export async function seedIfEmpty(db, {
  adminEmail = process.env.ADMIN_EMAIL || 'admin@reelseat.com',
  adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123',
  demoUserEmail = 'user@reelseat.com',
  demoUserPassword = 'User@1234',
} = {}) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n > 0) return false;

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const userHash = await bcrypt.hash(demoUserPassword, 10);

  transaction(db, () => {
    const insertUser = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
    insertUser.run('Admin', adminEmail, adminHash, 'admin');
    insertUser.run('Demo User', demoUserEmail, userHash, 'user');

    const insertMovie = db.prepare(`
      INSERT INTO movies (title, description, genre, language, duration_min, rating, poster_url, release_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`);
    const movieIds = MOVIES.map((m, i) => insertMovie.get(
      m.title, m.description, m.genre, m.language, m.duration_min, m.rating,
      `https://picsum.photos/seed/reelseat-${i + 1}/400/600`,
      new Date(Date.now() - i * 7 * 86400000).toISOString().slice(0, 10),
    ).id);

    const insertTheatre = db.prepare(
      'INSERT INTO theatres (name, location, seat_rows, seat_cols) VALUES (?, ?, ?, ?) RETURNING id',
    );
    const theatreIds = THEATRES.map((t) => insertTheatre.get(t.name, t.location, t.seat_rows, t.seat_cols).id);

    const insertShow = db.prepare('INSERT INTO shows (movie_id, theatre_id, start_time, price) VALUES (?, ?, ?, ?)');
    const hours = [10, 14, 18, 21];
    movieIds.forEach((movieId, mi) => {
      for (let day = 1; day <= 3; day++) {
        const theatreId = theatreIds[(mi + day) % theatreIds.length];
        insertShow.run(movieId, theatreId, futureSlot(day, hours[(mi + day) % hours.length]), 180 + (mi % 3) * 60);
        insertShow.run(movieId, theatreIds[(mi + day + 1) % theatreIds.length],
          futureSlot(day, hours[(mi + day + 2) % hours.length]), 220 + (mi % 2) * 50);
      }
    });
  });

  console.log(`[seed] Seeded demo data. Admin: ${adminEmail}  User: ${demoUserEmail}`);
  return true;
}

// Allow `npm run seed` to initialise a database file directly.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { createDb } = await import('./db.js');
  const db = createDb(process.env.DB_PATH || 'reelseat.db');
  const seeded = await seedIfEmpty(db);
  if (!seeded) console.log('[seed] Database already has users - nothing to do.');
}
