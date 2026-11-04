import { badRequest } from './errors.js';

/**
 * Minimal schema validator. Each field rule: { type, required, min, max, pattern, trim }.
 * Returns a clean object containing only declared fields, or throws a 400 HttpError.
 */
export function validate(body, schema) {
  const input = body && typeof body === 'object' ? body : {};
  const out = {};
  const errors = {};

  for (const [field, rule] of Object.entries(schema)) {
    let value = input[field];
    if (typeof value === 'string' && rule.type !== 'password') value = value.trim();

    if (value === undefined || value === null || value === '') {
      if (rule.required) errors[field] = 'is required';
      else if (rule.default !== undefined) out[field] = rule.default;
      continue;
    }

    switch (rule.type) {
      case 'string':
      case 'password':
        if (typeof value !== 'string') { errors[field] = 'must be a string'; continue; }
        if (rule.min && value.length < rule.min) { errors[field] = `must be at least ${rule.min} characters`; continue; }
        if (rule.max && value.length > rule.max) { errors[field] = `must be at most ${rule.max} characters`; continue; }
        if (rule.pattern && !rule.pattern.test(value)) { errors[field] = rule.message || 'is invalid'; continue; }
        break;
      case 'int':
      case 'number': {
        const n = Number(value);
        if (!Number.isFinite(n) || (rule.type === 'int' && !Number.isInteger(n))) {
          errors[field] = `must be ${rule.type === 'int' ? 'an integer' : 'a number'}`; continue;
        }
        if (rule.min !== undefined && n < rule.min) { errors[field] = `must be >= ${rule.min}`; continue; }
        if (rule.max !== undefined && n > rule.max) { errors[field] = `must be <= ${rule.max}`; continue; }
        value = n;
        break;
      }
      case 'datetime': {
        const d = new Date(value);
        if (typeof value !== 'string' || Number.isNaN(d.getTime())) { errors[field] = 'must be an ISO date-time'; continue; }
        value = d.toISOString();
        break;
      }
      case 'date':
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
          errors[field] = 'must be a YYYY-MM-DD date'; continue;
        }
        break;
      case 'url':
        if (typeof value !== 'string' || !/^https?:\/\/\S+$/i.test(value) || value.length > 500) {
          errors[field] = 'must be an http(s) URL'; continue;
        }
        break;
      case 'stringArray':
        if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
          errors[field] = 'must be an array of strings'; continue;
        }
        if (rule.min && value.length < rule.min) { errors[field] = `must contain at least ${rule.min} item(s)`; continue; }
        if (rule.max && value.length > rule.max) { errors[field] = `must contain at most ${rule.max} items`; continue; }
        value = value.map((v) => v.trim().toUpperCase());
        break;
      default:
        throw new Error(`Unknown rule type ${rule.type}`);
    }
    out[field] = value;
  }

  if (Object.keys(errors).length) throw badRequest('Validation failed', errors);
  return out;
}

export function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid id');
  return id;
}

/** Converts a 0-based row index to a letter: 0 -> A. */
export const rowLabel = (i) => String.fromCharCode(65 + i);

/** Validates seat codes against a theatre layout. Returns sorted unique seats. */
export function validateSeats(seats, theatre) {
  const unique = [...new Set(seats)];
  if (unique.length !== seats.length) throw badRequest('Duplicate seats in request');
  const invalid = unique.filter((s) => {
    const m = /^([A-Z])(\d{1,2})$/.exec(s);
    if (!m) return true;
    const row = m[1].charCodeAt(0) - 65;
    const col = Number(m[2]);
    return row >= theatre.seat_rows || col < 1 || col > theatre.seat_cols;
  });
  if (invalid.length) throw badRequest(`Invalid seat(s): ${invalid.join(', ')}`);
  return unique.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}
