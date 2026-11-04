import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Alert from '../components/Alert';
import ConfirmButton from '../components/ConfirmButton';
import Poster from '../components/Poster';
import Spinner from '../components/Spinner';
import { formatDateTime, formatPrice, isPast } from '../utils/format';

export default function Bookings() {
  const location = useLocation();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(location.state?.flash || '');

  useEffect(() => {
    // Clear router state so the flash message doesn't reappear on refresh.
    if (location.state?.flash) navigate(location.pathname, { replace: true, state: null });
    api.listBookings().then(setBookings).catch((err) => setError(err.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = async (b) => {
    setError('');
    try {
      await api.deleteBooking(b.id);
      setBookings((cur) => cur.filter((x) => x.id !== b.id));
      setFlash(`Booking #${b.id} cancelled.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const upcoming = bookings?.filter((b) => !isPast(b.start_time)) || [];
  const past = bookings?.filter((b) => isPast(b.start_time)) || [];

  const renderCard = (b) => {
    const done = isPast(b.start_time);
    return (
      <article className={`card booking-card${done ? ' booking-past' : ''}`} key={b.id}>
        <Poster src={b.movie_poster} title={b.movie_title} size="sm" />
        <div className="booking-info">
          <h3>{b.movie_title}</h3>
          <p className="muted small">{b.theatre_name} · {b.theatre_location}</p>
          <p>{formatDateTime(b.start_time)}</p>
          <p>
            <strong>Seats:</strong> {b.seats.join(', ')} <span className="muted">({b.seats.length})</span>
          </p>
          <p className="muted small">Booking #{b.id} · {formatPrice(b.total_amount)}</p>
        </div>
        {!done && (
          <div className="booking-actions">
            <Link className="btn btn-secondary btn-sm" to={`/shows/${b.show_id}/seats?booking=${b.id}`}>Edit seats</Link>
            <ConfirmButton onConfirm={() => cancel(b)} confirmLabel="Yes, cancel">Cancel booking</ConfirmButton>
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="container page">
      <div className="page-header"><h1>My bookings</h1></div>
      <Alert type="success" onClose={() => setFlash('')}>{flash}</Alert>
      <Alert onClose={() => setError('')}>{error}</Alert>
      {!bookings ? (
        !error && <Spinner label="Loading bookings" />
      ) : bookings.length === 0 ? (
        <div className="empty">
          <p>You haven't booked anything yet.</p>
          <Link to="/movies" className="btn btn-primary">Browse movies</Link>
        </div>
      ) : (
        <>
          <h2>Upcoming</h2>
          {upcoming.length ? <div className="booking-list">{upcoming.map(renderCard)}</div> : <p className="muted">No upcoming bookings.</p>}
          {past.length > 0 && (
            <>
              <h2>Past</h2>
              <div className="booking-list">{past.map(renderCard)}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
