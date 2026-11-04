import { HttpError } from '../errors.js';

/**
 * Tiny fixed-window, in-memory rate limiter keyed by client IP.
 * Good enough for a single-process deployment; swap for a shared store when scaling out.
 */
export function rateLimit({ windowMs = 15 * 60 * 1000, max = 20 } = {}) {
  if (max === Infinity) return (_req, _res, next) => next();
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(new HttpError(429, 'Too many attempts, please try again later'));
    }
    next();
  };
}
