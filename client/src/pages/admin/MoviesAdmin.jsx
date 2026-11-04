import { useState } from 'react';
import { api } from '../../api/client';
import ConfirmButton from '../../components/ConfirmButton';
import { formatDuration } from '../../utils/format';

const EMPTY = {
  title: '', genre: '', language: '', duration_min: '', rating: 'UA',
  release_date: '', poster_url: '', description: '',
};

export default function MoviesAdmin({ movies, run }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const ok = await run(
      () => api.createMovie({ ...form, duration_min: Number(form.duration_min) }),
      `Movie "${form.title}" added.`,
    );
    if (ok) setForm(EMPTY);
    setSaving(false);
  };

  return (
    <div className="admin-grid">
      <form className="card admin-form" onSubmit={submit}>
        <h2>Add movie</h2>
        <label>Title<input name="title" value={form.title} onChange={update} required maxLength={150} /></label>
        <div className="form-row">
          <label>Genre<input name="genre" value={form.genre} onChange={update} placeholder="Action, Drama" /></label>
          <label>Language<input name="language" value={form.language} onChange={update} /></label>
        </div>
        <div className="form-row">
          <label>Duration (min)<input name="duration_min" type="number" min="1" max="600" value={form.duration_min} onChange={update} required /></label>
          <label>
            Rating
            <select name="rating" value={form.rating} onChange={update}>
              {['U', 'UA', 'A', 'S'].map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
        </div>
        <label>Release date<input name="release_date" type="date" value={form.release_date} onChange={update} /></label>
        <label>Poster URL<input name="poster_url" type="url" value={form.poster_url} onChange={update} placeholder="https://…" /></label>
        <label>Description<textarea name="description" rows="3" value={form.description} onChange={update} maxLength={2000} /></label>
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add movie'}</button>
      </form>

      <div className="card table-card">
        <h2>Movies ({movies.length})</h2>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Title</th><th>Genre</th><th>Language</th><th>Length</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {movies.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.title}</strong> <span className="chip">{m.rating}</span></td>
                  <td>{m.genre}</td>
                  <td>{m.language}</td>
                  <td>{formatDuration(m.duration_min)}</td>
                  <td className="actions">
                    <ConfirmButton
                      confirmLabel="Delete movie, its shows & bookings?"
                      onConfirm={() => run(() => api.deleteMovie(m.id), `Movie "${m.title}" deleted.`)}
                    >Delete</ConfirmButton>
                  </td>
                </tr>
              ))}
              {movies.length === 0 && <tr><td colSpan="5" className="muted">No movies yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
