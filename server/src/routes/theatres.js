import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { notFound } from '../errors.js';
import { parseId, validate } from '../validation.js';

export function theatresRouter({ db }) {
  const router = Router();

  const listTheatres = db.prepare('SELECT * FROM theatres ORDER BY name');
  const insertTheatre = db.prepare(
    'INSERT INTO theatres (name, location, seat_rows, seat_cols) VALUES (:name, :location, :seat_rows, :seat_cols) RETURNING *',
  );
  const deleteTheatre = db.prepare('DELETE FROM theatres WHERE id = ?');

  router.get('/', (_req, res) => res.json(listTheatres.all()));

  router.post('/', requireRole('admin'), (req, res) => {
    const data = validate(req.body, {
      name: { type: 'string', required: true, max: 100 },
      location: { type: 'string', max: 150, default: '' },
      seat_rows: { type: 'int', required: true, min: 1, max: 26 },
      seat_cols: { type: 'int', required: true, min: 1, max: 30 },
    });
    res.status(201).json(insertTheatre.get(data));
  });

  router.delete('/:id', requireRole('admin'), (req, res) => {
    const { changes } = deleteTheatre.run(parseId(req.params.id));
    if (!changes) throw notFound('Theatre');
    res.status(204).end();
  });

  return router;
}
