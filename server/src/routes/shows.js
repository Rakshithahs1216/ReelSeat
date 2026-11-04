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
  const listShows = db.prepare(`${SHOW_SELECT} ORDER BY s.start_time`);
  const listShowsForMovie = db.prepare(`${SHOW_SELECT} WHERE s.movie_id = ? ORDER BY s.start_time`);
  // One query: every booked seat, flagged when it belongs to the requesting user.
  const bookedSeats = db.prepare(`
    SELECT bs.seat, bs.booking_id, (b.user_id = ?) AS mine
    FROM booking_seats bs JOIN bookings b ON b.id = bs.booking_id
    WHERE bs.show_id = ?`);
  const movieExists = db.prepare('SELECT 1 FROM movies WHERE id = ?');
  const theatreExists = db.prepare('SELECT 1 FROM theatres WHERE id = ?');
  const insertShow = db.prepare(
    'INSERT INTO shows (movie_id, theatre_id, start_time, price) VALUES (:movie_id, :theatre_id, :start_time, :price) RETURNING id',
  );
  const deleteShow = db.prepare('DELETE FROM shows WHERE id = ?');

  router.get('/', (req, res) => {
    if (req.query.movieId !== undefined) {
      return res.json(listShowsForMovie.all(parseId(req.query.movieId)));
    }
    res.json(listShows.all());
  });

  router.get('/:id', (req, res) => {
    const show = getShow.get(parseId(req.params.id));
    if (!show) throw notFound('Show');
    const seats = bookedSeats.all(req.user.id, show.id);
    // Only reveal booking ids for the caller's own seats, never other users'.
    res.json({
      ...show,
      booked_seats: seats.map((s) => s.seat),
      my_seats: seats.filter((s) => s.mine).map((s) => ({ seat: s.seat, booking_id: s.booking_id })),
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
