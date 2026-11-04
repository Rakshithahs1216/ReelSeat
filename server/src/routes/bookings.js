import { Router } from 'express';
import { HttpError, badRequest, notFound } from '../errors.js';
import { transaction } from '../db.js';
import { parseId, validate, validateSeats } from '../validation.js';

const MAX_SEATS = 10;

const BOOKING_SELECT = `
  SELECT b.id, b.user_id, b.show_id, b.total_amount, b.created_at, b.updated_at,
         s.start_time, s.price,
         m.id AS movie_id, m.title AS movie_title, m.poster_url AS movie_poster,
         t.name AS theatre_name, t.location AS theatre_location,
         u.name AS user_name, u.email AS user_email,
         (SELECT json_group_array(seat) FROM (
            SELECT seat FROM booking_seats bs WHERE bs.booking_id = b.id
            ORDER BY substr(seat, 1, 1), CAST(substr(seat, 2) AS INTEGER))) AS seats
  FROM bookings b
  JOIN shows s ON s.id = b.show_id
  JOIN movies m ON m.id = s.movie_id
  JOIN theatres t ON t.id = s.theatre_id
  JOIN users u ON u.id = b.user_id`;

const hydrate = (row) => row && { ...row, seats: JSON.parse(row.seats) };

export function bookingsRouter({ db }) {
  const router = Router();

  const getBooking = db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`);
  const listForUser = db.prepare(`${BOOKING_SELECT} WHERE b.user_id = ? ORDER BY s.start_time DESC`);
  const listAll = db.prepare(`${BOOKING_SELECT} ORDER BY s.start_time DESC`);
  const getShowWithLayout = db.prepare(`
    SELECT s.id, s.start_time, s.price, t.seat_rows, t.seat_cols
    FROM shows s JOIN theatres t ON t.id = s.theatre_id WHERE s.id = ?`);
  const takenSeats = db.prepare('SELECT seat FROM booking_seats WHERE show_id = ? AND booking_id != ?');
  const insertBooking = db.prepare(
    'INSERT INTO bookings (user_id, show_id, total_amount) VALUES (?, ?, ?) RETURNING id',
  );
  const insertSeat = db.prepare('INSERT INTO booking_seats (booking_id, show_id, seat) VALUES (?, ?, ?)');
  const clearSeats = db.prepare('DELETE FROM booking_seats WHERE booking_id = ?');
  const updateBooking = db.prepare(
    "UPDATE bookings SET total_amount = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
  );
  const deleteBooking = db.prepare('DELETE FROM bookings WHERE id = ?');

  const seatsSchema = { seats: { type: 'stringArray', required: true, min: 1, max: MAX_SEATS } };

  /** Loads a show that is still open for booking and validates requested seats against it. */
  function prepareSeats(showId, rawSeats, excludeBookingId = 0) {
    const show = getShowWithLayout.get(showId);
    if (!show) throw notFound('Show');
    if (new Date(show.start_time) <= new Date()) throw badRequest('This show has already started');
    const seats = validateSeats(rawSeats, show);
    const taken = new Set(takenSeats.all(showId, excludeBookingId).map((r) => r.seat));
    const conflicts = seats.filter((s) => taken.has(s));
    if (conflicts.length) {
      throw new HttpError(409, `Seat(s) already booked: ${conflicts.join(', ')}`, { conflicts });
    }
    return { show, seats };
  }

  function loadOwnedBooking(req) {
    const booking = hydrate(getBooking.get(parseId(req.params.id)));
    if (!booking) throw notFound('Booking');
    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      // Do not leak existence of other users' bookings.
      throw notFound('Booking');
    }
    return booking;
  }

  router.get('/', (req, res) => {
    const rows = req.user.role === 'admin' ? listAll.all() : listForUser.all(req.user.id);
    res.json(rows.map(hydrate));
  });

  router.get('/:id', (req, res) => {
    res.json(loadOwnedBooking(req));
  });

  router.post('/', (req, res) => {
    const { showId } = validate(req.body, { showId: { type: 'int', required: true, min: 1 } });
    const { seats: rawSeats } = validate(req.body, seatsSchema);
    const id = transaction(db, () => {
      const { show, seats } = prepareSeats(showId, rawSeats);
      const { id: bookingId } = insertBooking.get(req.user.id, show.id, seats.length * show.price);
      for (const seat of seats) insertSeat.run(bookingId, show.id, seat);
      return bookingId;
    });
    res.status(201).json(hydrate(getBooking.get(id)));
  });

  router.put('/:id', (req, res) => {
    const booking = loadOwnedBooking(req);
    if (booking.user_id !== req.user.id) throw new HttpError(403, 'Only the booking owner can edit it');
    const { seats: rawSeats } = validate(req.body, seatsSchema);
    transaction(db, () => {
      const { show, seats } = prepareSeats(booking.show_id, rawSeats, booking.id);
      clearSeats.run(booking.id);
      for (const seat of seats) insertSeat.run(booking.id, show.id, seat);
      updateBooking.run(seats.length * show.price, booking.id);
    });
    res.json(hydrate(getBooking.get(booking.id)));
  });

  router.delete('/:id', (req, res) => {
    const booking = loadOwnedBooking(req);
    if (req.user.role !== 'admin' && new Date(booking.start_time) <= new Date()) {
      throw badRequest('Bookings for past shows cannot be cancelled');
    }
    deleteBooking.run(booking.id);
    res.status(204).end();
  });

  return router;
}
