import { useState } from 'react';
import { api } from '../../api/client';
import ConfirmButton from '../../components/ConfirmButton';

const EMPTY = { name: '', location: '', seat_rows: '8', seat_cols: '12' };

export default function TheatresAdmin({ theatres, run }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const ok = await run(
      () => api.createTheatre({ ...form, seat_rows: Number(form.seat_rows), seat_cols: Number(form.seat_cols) }),
      `Theatre "${form.name}" added.`,
    );
    if (ok) setForm(EMPTY);
    setSaving(false);
  };

  const capacity = Number(form.seat_rows) * Number(form.seat_cols) || 0;

  return (
    <div className="admin-grid">
      <form className="card admin-form" onSubmit={submit}>
        <h2>Add theatre</h2>
        <label>Name<input name="name" value={form.name} onChange={update} required maxLength={100} /></label>
        <label>Location<input name="location" value={form.location} onChange={update} maxLength={150} /></label>
        <div className="form-row">
          <label>Rows (1–26)<input name="seat_rows" type="number" min="1" max="26" value={form.seat_rows} onChange={update} required /></label>
          <label>Seats per row (1–30)<input name="seat_cols" type="number" min="1" max="30" value={form.seat_cols} onChange={update} required /></label>
        </div>
        <p className="muted small">Capacity: {capacity} seats</p>
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add theatre'}</button>
      </form>

      <div className="card table-card">
        <h2>Theatres ({theatres.length})</h2>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Name</th><th>Location</th><th>Layout</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {theatres.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td>{t.location}</td>
                  <td>{t.seat_rows} × {t.seat_cols} ({t.seat_rows * t.seat_cols})</td>
                  <td className="actions">
                    <ConfirmButton
                      confirmLabel="Delete theatre, its shows & bookings?"
                      onConfirm={() => run(() => api.deleteTheatre(t.id), `Theatre "${t.name}" deleted.`)}
                    >Delete</ConfirmButton>
                  </td>
                </tr>
              ))}
              {theatres.length === 0 && <tr><td colSpan="4" className="muted">No theatres yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
