import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { redirectTarget } from '../context/auth';

function jsonResponse(status, body) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider><App /></AuthProvider>
    </MemoryRouter>,
  );
}

const ADMIN = { id: 1, name: 'Admin', email: 'admin@reelseat.com', role: 'admin' };
const USER = { id: 2, name: 'Demo User', email: 'user@reelseat.com', role: 'user' };

/** Minimal fake backend keyed by "METHOD path". */
function mockApi(routes) {
  global.fetch = vi.fn((url, opts = {}) => {
    const path = url.replace(/^\/api/, '').split('?')[0];
    const handler = routes[`${opts.method || 'GET'} ${path}`];
    return handler ? handler(opts) : jsonResponse(404, { error: 'not mocked' });
  });
}

describe('role-based routing', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends anonymous visitors to the login page', async () => {
    mockApi({});
    renderAt('/movies');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('redirects an admin to the admin panel after login and sends the bearer token', async () => {
    mockApi({
      'POST /auth/login': () => jsonResponse(200, { token: 'tok-admin', user: ADMIN }),
      'GET /movies': () => jsonResponse(200, []),
      'GET /theatres': () => jsonResponse(200, []),
      'GET /shows': () => jsonResponse(200, []),
      'GET /bookings': () => jsonResponse(200, []),
    });
    renderAt('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'admin@reelseat.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Admin@123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Admin panel' })).toBeInTheDocument();
    expect(localStorage.getItem('reelseat.token')).toBe('tok-admin');
    const moviesCall = global.fetch.mock.calls.find(([u]) => u === '/api/movies');
    expect(moviesCall[1].headers.Authorization).toBe('Bearer tok-admin');
  });

  it('redirects a regular user to the movie list after login', async () => {
    mockApi({
      'POST /auth/login': () => jsonResponse(200, { token: 'tok-user', user: USER }),
      'GET /movies': () => jsonResponse(200, [
        { id: 1, title: 'Orbitfall', genre: 'Sci-Fi', language: 'English', duration_min: 155, rating: 'UA', poster_url: '' },
      ]),
    });
    renderAt('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'user@reelseat.com');
    await userEvent.type(screen.getByLabelText('Password'), 'User@1234');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Now showing' })).toBeInTheDocument();
    expect(await screen.findByText('Orbitfall')).toBeInTheDocument();
  });

  it('keeps regular users out of the admin panel', async () => {
    localStorage.setItem('reelseat.token', 'tok-user');
    mockApi({
      'GET /auth/me': () => jsonResponse(200, { user: USER }),
      'GET /movies': () => jsonResponse(200, []),
    });
    renderAt('/admin');
    expect(await screen.findByRole('heading', { name: 'Now showing' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Admin panel' })).not.toBeInTheDocument();
  });

  it('logs out when the stored token is rejected', async () => {
    localStorage.setItem('reelseat.token', 'expired');
    mockApi({ 'GET /auth/me': () => jsonResponse(401, { error: 'Invalid or expired token' }) });
    renderAt('/bookings');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(localStorage.getItem('reelseat.token')).toBeNull();
  });

  it('shows the server error on failed login', async () => {
    mockApi({ 'POST /auth/login': () => jsonResponse(401, { error: 'Invalid email or password' }) });
    renderAt('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'x@y.z');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });
});

describe('redirectTarget', () => {
  it('honours the original destination only when the role allows it', () => {
    expect(redirectTarget(USER, '/bookings')).toBe('/bookings');
    expect(redirectTarget(USER, '/admin')).toBe('/movies');
    expect(redirectTarget(ADMIN, '/bookings')).toBe('/admin');
    expect(redirectTarget(ADMIN, undefined)).toBe('/admin');
  });
});
