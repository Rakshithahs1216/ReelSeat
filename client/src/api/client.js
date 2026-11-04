const TOKEN_KEY = 'reelseat.token';
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Listeners notified when the server rejects our token (expired / revoked). */
const unauthorizedListeners = new Set();
export const onUnauthorized = (fn) => {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
};

/**
 * Fetch wrapper that attaches the JWT as a Bearer token and normalises errors.
 */
export async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Please check your connection.');
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // Pass the token that was rejected so listeners can ignore stale responses.
    if (res.status === 401 && auth && token) unauthorizedListeners.forEach((fn) => fn(token));
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data?.details);
  }
  return data;
}

const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')).toString();
  return s ? `?${s}` : '';
};

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  register: (data) => request('/auth/register', { method: 'POST', body: data, auth: false }),
  me: () => request('/auth/me'),

  listMovies: (params = {}) => request(`/movies${qs(params)}`),
  getMovie: (id) => request(`/movies/${id}`),
  createMovie: (data) => request('/movies', { method: 'POST', body: data }),
  deleteMovie: (id) => request(`/movies/${id}`, { method: 'DELETE' }),

  listTheatres: () => request('/theatres'),
  createTheatre: (data) => request('/theatres', { method: 'POST', body: data }),
  deleteTheatre: (id) => request(`/theatres/${id}`, { method: 'DELETE' }),

  listShows: (params = {}) => request(`/shows${qs(params)}`),
  getShow: (id) => request(`/shows/${id}`),
  createShow: (data) => request('/shows', { method: 'POST', body: data }),
  deleteShow: (id) => request(`/shows/${id}`, { method: 'DELETE' }),

  listBookings: () => request('/bookings'),
  getBooking: (id) => request(`/bookings/${id}`),
  createBooking: (showId, seats) => request('/bookings', { method: 'POST', body: { showId, seats } }),
  updateBooking: (id, seats) => request(`/bookings/${id}`, { method: 'PUT', body: { seats } }),
  deleteBooking: (id) => request(`/bookings/${id}`, { method: 'DELETE' }),
};
