import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import Alert from '../components/Alert';
import Poster from '../components/Poster';
import Spinner from '../components/Spinner';
import { formatDate, formatDuration, formatPrice, formatTime } from '../utils/format';

/** Groups shows into { date -> { theatre -> shows[] } } for display. */
function groupShows(shows) {
  const byDate = new Map();
  for (const s of shows) {
    const day = formatDate(s.start_time);
    if (!byDate.has(day)) byDate.set(day, new Map());
    const byTheatre = byDate.get(day);
    const key = `${s.theatre_name}|${s.theatre_location}`;
    if (!byTheatre.has(key)) byTheatre.set(key, []);
    byTheatre.get(key).push(s);
  }
  return byDate;
}

export default function MovieDetails() {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getMovie(id).then(setMovie).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <div className="container page"><Alert>{error}</Alert><Link to="/movies">← Back to movies</Link></div>;
  if (!movie) return <Spinner label="Loading movie" />;

  const grouped = groupShows(movie.shows);

  return (
    <div className="container page">
      <Link to="/movies" className="back-link">← All movies</Link>
      <section className="movie-hero">
        <Poster src={movie.poster_url} title={movie.title} size="lg" alt={`${movie.title} poster`} />
        <div>
          <h1>{movie.title}</h1>
          <div className="chips">
            <span className="chip">{movie.rating}</span>
            <span className="chip">{formatDuration(movie.duration_min)}</span>
            {movie.language && <span className="chip">{movie.language}</span>}
            {movie.genre.split(',').filter(Boolean).map((g) => <span className="chip chip-soft" key={g}>{g.trim()}</span>)}
          </div>
          {movie.release_date && <p className="muted">Released {new Date(movie.release_date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>}
          <p className="description">{movie.description}</p>
        </div>
      </section>

      <section>
        <h2>Book tickets</h2>
        {grouped.size === 0 ? (
          <p className="empty">No upcoming shows for this movie yet.</p>
        ) : (
          [...grouped].map(([day, theatres]) => (
            <div className="show-day" key={day}>
              <h3>{day}</h3>
              {[...theatres].map(([key, shows]) => {
                const [name, location] = key.split('|');
                return (
                  <div className="theatre-row" key={key}>
                    <div>
                      <strong>{name}</strong>
                      <div className="muted small">{location}</div>
                    </div>
                    <div className="showtimes">
                      {shows.map((s) => (
                        <Link key={s.id} to={`/shows/${s.id}/seats`} className="showtime">
                          {formatTime(s.start_time)}
                          <small>{formatPrice(s.price)}</small>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
