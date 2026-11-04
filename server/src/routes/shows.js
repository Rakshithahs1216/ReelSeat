import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { badRequest, notFound } from '../errors.js';
import { parseId, validate } from '../validation.js';

const SHOW_SELECT = `
  SELECT s.id, s.movie_id, s.theatre_id, s.start_time, s.price,
         m.title AS movie_title, m.poster_url AS movie_poster, m.duration_min AS movie_duration,
         t.name AS theatre_name, t.location AS theatre_location, t.seat_rows, t.seat_cols
  FROM shows s
  JOIN movies m ON m.id = s.movie_id
  JOIN theatres t ON t.id = s.theatre_id`;

export function showsRouter({ db }) {
  const router = Router();

  const getShow = db.prepare(`${SHOW_SELECT} WHERE s.id = ?`);
  const bookedSeats = db.prepare('SELECT seat, booking_id FROM booking_seats WHERE show_id = ?');
  const movieExists = db.prepare('SELECT 1 FROM movies WHERE id = ?');
  const theatreExists = db.prepare('SELECT 1 FROM theatres WHERE id = ?');
  const insertShow = db.prepare(
    'INSERT INTO shows (movie_id, theatre_id, start_time, price) VALUES (:movie_id, :theatre_id, :start_time, :price) RETURNING id',
  );
  const deleteShow = db.prepare('DELETE FROM shows WHERE id = ?');

  router.get('/', (req, res) => {
    if (req.query.movieId !== undefined) {
      const movieId = parseId(req.query.movieId);
      return res.json(db.prepare(`${SHOW_SELECT} WHERE s.movie_id = ? ORDER BY s.start_time`).all(movieId));
    }
    res.json(db.prepare(`${SHOW_SELECT} ORDER BY s.start_time`).all());
  });

  router.get('/:id', (req, res) => {
    const show = getShow.get(parseId(req.params.id));
    if (!show) throw notFound('Show');
    const seats = bookedSeats.all(show.id);
    // Only reveal which seats belong to the caller's own bookings, not other users' booking ids.
    const ownBookingIds = new Set(
      db.prepare('SELECT id FROM bookings WHERE show_id = ? AND user_id = ?').all(show.id, req.user.id).map((b) => b.id),
    );
    res.json({
      ...show,
      booked_seats: seats.map((s) => s.seat),
      my_seats: seats.filter((s) => ownBookingIds.has(s.booking_id)).map((s) => ({ seat: s.seat, booking_id: s.booking_id })),
    });
  });

  router.post('/', requireRole('admin'), (req, res) => {
    const data = validate(req.body, {
      movie_id: { type: 'int', required: true, min: 1 },
      theatre_id: { type: 'int', required: true, min: 1 },
      start_time: { type: 'datetime', required: true },
      price: { type: 'number', required: true, min: 0, max: 100000 },
    });
    if (!movieExists.get(data.movie_id)) throw badRequest('Movie does not exist');
    if (!theatreExists.get(data.theatre_id)) throw badRequest('Theatre does not exist');
    if (new Date(data.start_time) <= new Date()) throw badRequest('Show time must be in the future');
    const { id } = insertShow.get(data);
    res.status(201).json(getShow.get(id));
  });

  router.delete('/:id', requireRole('admin'), (req, res) => {
    const { changes } = deleteShow.run(parseId(req.params.id));
    if (!changes) throw notFound('Show');
    res.status(204).end();
  });

  return router;
}
