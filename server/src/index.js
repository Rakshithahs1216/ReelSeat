import { config } from './config.js';
import { createDb } from './db.js';
import { createApp } from './app.js';
import { seedIfEmpty } from './seed.js';

const db = createDb(config.dbPath);
await seedIfEmpty(db);

const app = createApp({
  db,
  jwtSecret: config.jwtSecret,
  jwtExpiresIn: config.jwtExpiresIn,
  clientOrigin: config.clientOrigin,
});

app.listen(config.port, () => {
  console.log(`ReelSeat API listening on http://localhost:${config.port}`);
});
