import { HttpError } from '../errors.js';

/**
 * Tiny fixed-window, in-memory rate limiter keyed by client IP.
 * Good enough for a single-process deployment; swap for a shared store when scaling out.
 *
 * Options:
 * - windowMs / max: allow `max` counted requests per window
 * - countOnlyFailures: only responses with status >= 400 count towards the limit
 *   (so legitimate successful logins never lock anyone out)
 */
export function rateLimit({ windowMs = 15 * 60 * 1000, max = 20, countOnlyFailures = false } = {}) {
  if (max === Infinity) return (_req, _res, next) => next();
  const hits = new Map();

  // Periodically drop expired windows so memory stays bounded without per-request sweeps.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, Math.min(windowMs, 60_000));
  sweeper.unref();

  const entryFor = (key, now) => {
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    return entry;
  };

  return (req, res, next) => {
    const now = Date.now();
    const entry = entryFor(req.ip, now);
    if (entry.count >= max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(new HttpError(429, 'Too many attempts, please try again later'));
    }
    if (countOnlyFailures) {
      res.on('finish', () => { if (res.statusCode >= 400) entryFor(req.ip, Date.now()).count += 1; });
    } else {
      entry.count += 1;
    }
    next();
  };
}
