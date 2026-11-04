import { useState } from 'react';
import { api } from '../../api/client';
import ConfirmButton from '../../components/ConfirmButton';
import { formatDateTime, formatPrice, isPast, localInputToIso } from '../../utils/format';

const EMPTY = { movie_id: '', theatre_id: '', start_time: '', price: '200' };

export default function ShowsAdmin({ shows, movies, theatres, run }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const ok = await run(
      () => api.createShow({
        movie_id: Number(form.movie_id),
        theatre_id: Number(form.theatre_id),
        start_time: localInputToIso(form.start_time),
        price: Number(form.price),
      }),
      'Show scheduled.',
    );
    if (ok) setForm(EMPTY);
    setSaving(false);
  };

  const canCreate = movies.length > 0 && theatres.length > 0;

  return (
    <div className="admin-grid">
      <form className="card admin-form" onSubmit={submit}>
        <h2>Schedule show</h2>
        {!canCreate && <p className="muted">Add at least one movie and one theatre first.</p>}
        <label>
          Movie
          <select name="movie_id" value={form.movie_id} onChange={update} required>
            <option value="">Select a movie</option>
            {movies.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </label>
        <label>
          Theatre
          <select name="theatre_id" value={form.theatre_id} onChange={update} required>
            <option value="">Select a theatre</option>
            {theatres.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <div className="form-row">
          <label>Start time<input name="start_time" type="datetime-local" value={form.start_time} onChange={update} required /></label>
          <label>Price (₹)<input name="price" type="number" min="0" step="10" value={form.price} onChange={update} required /></label>
        </div>
        <button className="btn btn-primary" disabled={saving || !canCreate}>{saving ? 'Saving…' : 'Add show'}</button>
      </form>

      <div className="card table-card">
        <h2>Shows ({shows.length})</h2>
        <div className="table-scroll">
          <table>
            <thead><tr><th>When</th><th>Movie</th><th>Theatre</th><th>Price</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {shows.map((s) => (
                <tr key={s.id} className={isPast(s.start_time) ? 'row-past' : ''}>
                  <td>{formatDateTime(s.start_time)}</td>
                  <td>{s.movie_title}</td>
                  <td>{s.theatre_name}</td>
                  <td>{formatPrice(s.price)}</td>
                  <td className="actions">
                    <ConfirmButton
                      confirmLabel="Delete + bookings?"
                      onConfirm={() => run(() => api.deleteShow(s.id), 'Show deleted.')}
                    >Delete</ConfirmButton>
                  </td>
                </tr>
              ))}
              {shows.length === 0 && <tr><td colSpan="5" className="muted">No shows scheduled.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
