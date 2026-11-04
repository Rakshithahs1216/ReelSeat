import jwt from 'jsonwebtoken';
import { HttpError } from '../errors.js';

export function signToken(user, secret, expiresIn) {
  return jwt.sign({ sub: String(user.id), role: user.role }, secret, {
    expiresIn,
    algorithm: 'HS256',
  });
}

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches the current user
 * (re-read from the database so deleted users / changed roles take effect immediately).
 */
export function authenticate(db, secret) {
  const findUser = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?');
  return (req, _res, next) => {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return next(new HttpError(401, 'Authentication required'));
    }
    let payload;
    try {
      payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch {
      return next(new HttpError(401, 'Invalid or expired token'));
    }
    const user = findUser.get(Number(payload.sub));
    if (!user) return next(new HttpError(401, 'User no longer exists'));
    req.user = { ...user };
    next();
  };
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new HttpError(403, 'You do not have permission to perform this action'));
  }
  next();
};
