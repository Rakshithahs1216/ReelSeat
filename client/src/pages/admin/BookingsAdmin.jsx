import { api } from '../../api/client';
import ConfirmButton from '../../components/ConfirmButton';
import { formatDateTime, formatPrice } from '../../utils/format';

export default function BookingsAdmin({ bookings, run }) {
  const revenue = bookings.reduce((sum, b) => sum + b.total_amount, 0);

  return (
    <div className="card table-card">
      <h2>All bookings ({bookings.length}) · {formatPrice(revenue)}</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>#</th><th>Customer</th><th>Movie</th><th>Show</th><th>Seats</th><th>Amount</th><th aria-label="Actions" /></tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td>{b.id}</td>
                <td>{b.user_name}<div className="muted small">{b.user_email}</div></td>
                <td>{b.movie_title}</td>
                <td>{formatDateTime(b.start_time)}<div className="muted small">{b.theatre_name}</div></td>
                <td>{b.seats.join(', ')}</td>
                <td>{formatPrice(b.total_amount)}</td>
                <td className="actions">
                  <ConfirmButton
                    confirmLabel="Cancel it?"
                    onConfirm={() => run(() => api.deleteBooking(b.id), `Booking #${b.id} cancelled.`)}
                  >Cancel</ConfirmButton>
                </td>
              </tr>
            ))}
            {bookings.length === 0 && <tr><td colSpan="7" className="muted">No bookings yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
