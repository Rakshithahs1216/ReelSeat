import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { notFound } from '../errors.js';
import { parseId, validate } from '../validation.js';

const MOVIE_SCHEMA = {
  title: { type: 'string', required: true, max: 150 },
  description: { type: 'string', max: 2000, default: '' },
  genre: { type: 'string', max: 60, default: '' },
  language: { type: 'string', max: 40, default: '' },
  duration_min: { type: 'int', required: true, min: 1, max: 600 },
  rating: { type: 'string', max: 10, default: 'UA' },
  poster_url: { type: 'url', default: '' },
  release_date: { type: 'date', default: null },
};

export function moviesRouter({ db }) {
  const router = Router();

  const getMovie = db.prepare('SELECT * FROM movies WHERE id = ?');
  const upcomingShows = db.prepare(`
    SELECT s.id, s.start_time, s.price, t.id AS theatre_id, t.name AS theatre_name, t.location AS theatre_location
    FROM shows s JOIN theatres t ON t.id = s.theatre_id
    WHERE s.movie_id = ? AND s.start_time > ?
    ORDER BY s.start_time`);
  const insertMovie = db.prepare(`
    INSERT INTO movies (title, description, genre, language, duration_min, rating, poster_url, release_date)
    VALUES (:title, :description, :genre, :language, :duration_min, :rating, :poster_url, :release_date)
    RETURNING *`);
  const deleteMovie = db.prepare('DELETE FROM movies WHERE id = ?');

  router.get('/', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const genre = typeof req.query.genre === 'string' ? req.query.genre.trim() : '';
    const clauses = [];
    const params = [];
    if (q) { clauses.push('title LIKE ?'); params.push(`%${q}%`); }
    if (genre) { clauses.push('genre LIKE ?'); params.push(`%${genre}%`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const movies = db.prepare(`SELECT * FROM movies ${where} ORDER BY release_date DESC, title`).all(...params);
    res.json(movies);
  });

  router.get('/:id', (req, res) => {
    const movie = getMovie.get(parseId(req.params.id));
    if (!movie) throw notFound('Movie');
    res.json({ ...movie, shows: upcomingShows.all(movie.id, new Date().toISOString()) });
  });

  router.post('/', requireRole('admin'), (req, res) => {
    const data = validate(req.body, MOVIE_SCHEMA);
    res.status(201).json(insertMovie.get(data));
  });

  router.delete('/:id', requireRole('admin'), (req, res) => {
    const { changes } = deleteMovie.run(parseId(req.params.id));
    if (!changes) throw notFound('Movie');
    res.status(204).end();
  });

  return router;
}
