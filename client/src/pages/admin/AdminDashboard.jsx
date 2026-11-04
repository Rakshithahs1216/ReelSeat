import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import Alert from '../../components/Alert';
import Spinner from '../../components/Spinner';
import MoviesAdmin from './MoviesAdmin';
import TheatresAdmin from './TheatresAdmin';
import ShowsAdmin from './ShowsAdmin';
import BookingsAdmin from './BookingsAdmin';

const TABS = [
  { key: 'movies', label: 'Movies' },
  { key: 'theatres', label: 'Theatres' },
  { key: 'shows', label: 'Shows' },
  { key: 'bookings', label: 'Bookings' },
];

export default function AdminDashboard() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'movies';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const reload = useCallback(async () => {
    try {
      const [movies, theatres, shows, bookings] = await Promise.all([
        api.listMovies(), api.listTheatres(), api.listShows(), api.listBookings(),
      ]);
      setData({ movies, theatres, shows, bookings });
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  /** Wraps a mutation: clears messages, runs it, reloads data and reports outcome. */
  const run = useCallback(async (fn, successMsg) => {
    setError('');
    setFlash('');
    try {
      await fn();
      await reload();
      setFlash(successMsg);
      return true;
    } catch (err) {
      const details = err.details ? ` (${Object.entries(err.details).map(([k, v]) => `${k} ${v}`).join('; ')})` : '';
      setError(err.message + details);
      return false;
    }
  }, [reload]);

  return (
    <div className="container page">
      <div className="page-header">
        <h1>Admin panel</h1>
      </div>

      {data && (
        <div className="stats">
          <div className="stat"><span>{data.movies.length}</span>Movies</div>
          <div className="stat"><span>{data.theatres.length}</span>Theatres</div>
          <div className="stat"><span>{data.shows.length}</span>Shows</div>
          <div className="stat"><span>{data.bookings.length}</span>Bookings</div>
        </div>
      )}

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`tab${tab === t.key ? ' tab-active' : ''}`}
            onClick={() => setParams({ tab: t.key })}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Alert type="success" onClose={() => setFlash('')}>{flash}</Alert>
      <Alert onClose={() => setError('')}>{error}</Alert>

      {!data ? (
        !error && <Spinner label="Loading dashboard" />
      ) : (
        <div role="tabpanel">
          {tab === 'movies' && <MoviesAdmin movies={data.movies} run={run} />}
          {tab === 'theatres' && <TheatresAdmin theatres={data.theatres} run={run} />}
          {tab === 'shows' && <ShowsAdmin shows={data.shows} movies={data.movies} theatres={data.theatres} run={run} />}
          {tab === 'bookings' && <BookingsAdmin bookings={data.bookings} run={run} />}
        </div>
      )}
    </div>
  );
}
