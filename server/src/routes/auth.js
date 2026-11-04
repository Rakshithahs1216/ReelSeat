import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { signToken } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { HttpError } from '../errors.js';
import { validate } from '../validation.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Used so that unknown-email logins cost the same time as wrong-password logins.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 10);

export function authRouter({ db, jwtSecret, jwtExpiresIn, authenticate, loginRateLimit }) {
  const router = Router();
  // Separate budgets: failed logins (brute force) vs. account creation (spam).
  const loginLimiter = rateLimit({ ...loginRateLimit, countOnlyFailures: true });
  const registerLimiter = rateLimit(loginRateLimit);

  const findByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
  const insertUser = db.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id, name, email, role',
  );

  const respondWithToken = (res, user, status = 200) => {
    const publicUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.status(status).json({ token: signToken(publicUser, jwtSecret, jwtExpiresIn), user: publicUser });
  };

  router.post('/register', registerLimiter, async (req, res) => {
    const data = validate(req.body, {
      name: { type: 'string', required: true, min: 2, max: 80 },
      email: { type: 'string', required: true, max: 120, pattern: EMAIL, message: 'must be a valid email' },
      password: { type: 'password', required: true, min: 8, max: 72 },
    });
    if (findByEmail.get(data.email)) throw new HttpError(409, 'An account with this email already exists');
    const hash = await bcrypt.hash(data.password, 10);
    // Self-registration always creates a regular user; admins are provisioned by seed/ops.
    const user = insertUser.get(data.name, data.email.toLowerCase(), hash, 'user');
    respondWithToken(res, user, 201);
  });

  router.post('/login', loginLimiter, async (req, res) => {
    const data = validate(req.body, {
      email: { type: 'string', required: true, max: 120 },
      password: { type: 'password', required: true, max: 72 },
    });
    const user = findByEmail.get(data.email);
    const ok = await bcrypt.compare(data.password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, 'Invalid email or password');
    respondWithToken(res, user);
  });

  router.get('/me', authenticate, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
