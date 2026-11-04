import crypto from 'node:crypto';

const isProduction = process.env.NODE_ENV === 'production';

function resolveJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (isProduction) {
    throw new Error('JWT_SECRET must be set in production');
  }
  console.warn('[config] JWT_SECRET not set - using a random secret; tokens reset on restart.');
  return crypto.randomBytes(32).toString('hex');
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  dbPath: process.env.DB_PATH || 'reelseat.db',
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};
