import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import Alert from '../components/Alert';
import SeatMap from '../components/SeatMap';
import Spinner from '../components/Spinner';
import { formatDateTime, formatPrice, isPast } from '../utils/format';

const MAX_SEATS = 10;
const seatSort = (a, b) => a.localeCompare(b, 'en', { numeric: true });

export default function SeatSelection() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('booking');
  const navigate = useNavigate();

  const [show, setShow] = useState(null);
  const [booking, setBooking] = useState(null);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [s, b] = await Promise.all([api.getShow(id), bookingId ? api.getBooking(bookingId) : null]);
    if (b && String(b.show_id) !== String(s.id)) throw new Error('This booking does not belong to this show');
    setShow(s);
    setBooking(b);
    return { show: s, booking: b };
  }, [id, bookingId]);

  useEffect(() => {
    load()
      .then(({ booking: b }) => setSelected(b ? b.seats : []))
      .catch((err) => setLoadError(err.message));
  }, [load]);

  if (loadError) {
    return <div className="container page"><Alert>{loadError}</Alert><Link to="/movies">← Back to movies</Link></div>;
  }
  if (!show) return <Spinner label="Loading seat map" />;

  const ownSeats = new Set(booking?.seats || []);
  const booked = show.booked_seats.filter((s) => !ownSeats.has(s));
  const total = selected.length * show.price;
  const started = isPast(show.start_time);
  const unchanged = booking && [...selected].sort(seatSort).join() === [...booking.seats].sort(seatSort).join();

  const toggle = (seat) => {
    setError('');
    setSelected((cur) => (cur.includes(seat) ? cur.filter((s) => s !== seat) : [...cur, seat].sort(seatSort)));
  };

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const result = booking
        ? await api.updateBooking(booking.id, selected)
        : await api.createBooking(show.id, selected);
      navigate('/bookings', {
        state: { flash: `${booking ? 'Updated' : 'Confirmed'} booking #${result.id}: seats ${result.seats.join(', ')}` },
      });
    } catch (err) {
      setError(err.message);
      if (err.status === 409) {
        // Someone grabbed a seat - refresh availability and drop conflicting seats.
        const conflicts = new Set(err.details?.conflicts || []);
        setSelected((cur) => cur.filter((s) => !conflicts.has(s)));
        load().catch(() => {});
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="container page">
      <Link to={`/movies/${show.movie_id}`} className="back-link">← {show.movie_title}</Link>
      <div className="page-header">
        <div>
          <h1>{booking ? `Edit booking #${booking.id}` : 'Choose your seats'}</h1>
          <p className="muted">
            {show.theatre_name} · {show.theatre_location} · {formatDateTime(show.start_time)}
          </p>
        </div>
      </div>

      {started && <Alert type="info">This show has already started; booking is closed.</Alert>}
      <Alert onClose={() => setError('')}>{error}</Alert>

      <div className="booking-layout">
        <div className="card seatmap-card">
          <SeatMap
            rows={show.seat_rows}
            cols={show.seat_cols}
            booked={started ? [...booked, ...Array.from(ownSeats)] : booked}
            selected={selected}
            onToggle={toggle}
            max={MAX_SEATS}
          />
        </div>

        <aside className="card summary">
          <h2>Summary</h2>
          <dl>
            <dt>Movie</dt><dd>{show.movie_title}</dd>
            <dt>Seats</dt><dd>{selected.length ? selected.join(', ') : '—'}</dd>
            <dt>Price</dt><dd>{formatPrice(show.price)} × {selected.length}</dd>
            <dt>Total</dt><dd className="total">{formatPrice(total)}</dd>
          </dl>
          {selected.length >= MAX_SEATS && <p className="muted small">Maximum of {MAX_SEATS} seats per booking.</p>}
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={started || submitting || selected.length === 0 || unchanged}
            onClick={submit}
          >
            {submitting ? 'Saving…' : booking ? 'Save changes' : `Book ${selected.length || ''} seat${selected.length === 1 ? '' : 's'}`}
          </button>
          {booking && <Link to="/bookings" className="btn btn-ghost btn-block">Cancel editing</Link>}
        </aside>
      </div>
    </div>
  );
}
