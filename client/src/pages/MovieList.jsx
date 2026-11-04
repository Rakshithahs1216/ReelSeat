import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import Alert from '../components/Alert';
import Poster from '../components/Poster';
import Spinner from '../components/Spinner';
import { formatDuration } from '../utils/format';

export default function MovieList() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('');

  useEffect(() => {
    api.listMovies()
      .then(setMovies)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const genres = useMemo(
    () => [...new Set(movies.flatMap((m) => m.genre.split(',').map((g) => g.trim()).filter(Boolean)))].sort(),
    [movies],
  );

  const visible = movies.filter((m) =>
    m.title.toLowerCase().includes(query.trim().toLowerCase()) &&
    (!genre || m.genre.toLowerCase().includes(genre.toLowerCase())));

  return (
    <div className="container page">
      <div className="page-header">
        <h1>Now showing</h1>
        <div className="filters">
          <input
            type="search"
            placeholder="Search movies…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search movies"
          />
          <select value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Filter by genre">
            <option value="">All genres</option>
            {genres.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      <Alert>{error}</Alert>
      {loading ? (
        <Spinner label="Loading movies" />
      ) : visible.length === 0 ? (
        <p className="empty">No movies match your filters.</p>
      ) : (
        <div className="movie-grid">
          {visible.map((m) => (
            <Link to={`/movies/${m.id}`} className="movie-card" key={m.id}>
              <Poster src={m.poster_url} title={m.title}>
                <span className="rating-chip">{m.rating}</span>
              </Poster>
              <div className="movie-card-body">
                <h3>{m.title}</h3>
                <p className="muted small">{m.genre}</p>
                <p className="muted small">{m.language} · {formatDuration(m.duration_min)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
