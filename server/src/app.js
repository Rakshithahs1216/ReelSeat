import express from 'express';
import cors from 'cors';
import { authenticate as makeAuthenticate } from './middleware/auth.js';
import { HttpError } from './errors.js';
import { authRouter } from './routes/auth.js';
import { moviesRouter } from './routes/movies.js';
import { theatresRouter } from './routes/theatres.js';
import { showsRouter } from './routes/shows.js';
import { bookingsRouter } from './routes/bookings.js';

/**
 * Builds the Express application. Dependencies are injected so tests can use an
 * in-memory database and a fixed secret.
 */
export function createApp({
  db,
  jwtSecret,
  jwtExpiresIn = '2h',
  clientOrigin = 'http://localhost:5173',
  loginRateLimit = { windowMs: 15 * 60 * 1000, max: 20 },
  trustProxy = false,
}) {
  const app = express();
  app.disable('x-powered-by');
  // When deployed behind a reverse proxy, set TRUST_PROXY so req.ip is the real client IP.
  app.set('trust proxy', trustProxy);
  app.use(cors({ origin: clientOrigin }));
  app.use(express.json({ limit: '50kb' }));
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    });
    next();
  });

  const authenticate = makeAuthenticate(db, jwtSecret);
  const deps = { db, jwtSecret, jwtExpiresIn, authenticate, loginRateLimit };

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRouter(deps));
  app.use('/api/movies', authenticate, moviesRouter(deps));
  app.use('/api/theatres', authenticate, theatresRouter(deps));
  app.use('/api/shows', authenticate, showsRouter(deps));
  app.use('/api/bookings', authenticate, bookingsRouter(deps));

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Endpoint not found')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON body' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large' });
    }
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, ...(err.details && { details: err.details }) });
    }
    if (typeof err.message === 'string' && err.message.includes('UNIQUE constraint failed: booking_seats')) {
      return res.status(409).json({ error: 'One or more seats were just booked by someone else' });
    }
    if (typeof err.message === 'string' && err.message.includes('UNIQUE constraint failed: users.email')) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
