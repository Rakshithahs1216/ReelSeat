# ReelSeat 🎬

A movie ticket booking web app. Users log in with role-based access, browse movies, pick seats on an interactive seat map, and manage their bookings. Admins manage movies, theatres and show timings.

**Stack:** React 19 + Vite + React Router · Node.js + Express 5 · SQLite (built-in `node:sqlite`) · JWT bearer auth · bcrypt

## Features

- **Login with role-based redirection.** Users go to `/movies` and admins go to `/admin`. Route guards stop users from opening admin pages, and the server enforces the same rules.
- **Movie listing and details.** Search, filter by genre, and see upcoming showtimes grouped by date and theatre.
- **Seat selection.** An interactive seat map shows available, selected and booked seats, with a live price total and a limit of 10 seats per booking.
- **Booking history.** Upcoming and past bookings, with **edit seats** and **cancel** for upcoming ones.
- **Admin panel.** Add and delete movies, theatres (with seat layout) and shows, and view or cancel every booking.
- **Token-authenticated API.** Every protected request sends `Authorization: Bearer <jwt>`. The app logs out automatically when the token expires.
- **No double booking.** Seats are checked inside a transaction, backed by a `UNIQUE(show_id, seat)` database constraint.

## Getting started

You need **Node.js 22.13 or newer**.

```bash
# 1. API (http://localhost:4000)
cd server
npm install
cp .env.example .env        # optional: set JWT_SECRET etc.
npm run dev

# 2. Web app (http://localhost:5173), in a second terminal
cd client
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server forwards `/api` to the backend on port 4000.

On first start, the server creates `reelseat.db` and fills it with demo data:

| Role  | Email                | Password    |
|-------|----------------------|-------------|
| Admin | `admin@reelseat.com` | `Admin@123` |
| User  | `user@reelseat.com`  | `User@1234` |

To reset the demo data, stop the server, delete `server/reelseat.db*`, and start it again.

### Configuration (`server/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | API port |
| `JWT_SECRET` | random per start (dev only) | Key used to sign tokens. **Required when `NODE_ENV=production`** |
| `JWT_EXPIRES_IN` | `2h` | How long a token stays valid |
| `DB_PATH` | `reelseat.db` | Location of the SQLite file |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Origin allowed by CORS |
| `TRUST_PROXY` | `false` | Express `trust proxy` setting, for running behind a reverse proxy |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | demo values | Initial admin account, created only when the database is empty |

## Testing

```bash
cd server && npm test     # API integration tests (node:test + supertest)
cd client && npm test     # UI tests (Vitest + Testing Library)
cd client && npm run lint && npm run build
```

The API tests cover authentication, role guards, catalogue CRUD, seat validation, double-booking prevention, booking ownership, and rate limiting. The UI tests cover the seat map, role-based redirects, sending the bearer token, and handling expired tokens.

## API overview

| Method | Path | Access |
|--------|------|--------|
| POST | `/api/auth/register`, `/api/auth/login` | public |
| GET | `/api/auth/me` | token |
| GET | `/api/movies`, `/api/movies/:id` | token |
| POST / DELETE | `/api/movies`, `/api/movies/:id` | admin |
| GET | `/api/theatres` | token |
| POST / DELETE | `/api/theatres`, `/api/theatres/:id` | admin |
| GET | `/api/shows`, `/api/shows/:id` | token |
| POST / DELETE | `/api/shows`, `/api/shows/:id` | admin |
| GET / POST | `/api/bookings` | token (admins see all bookings) |
| GET / PUT / DELETE | `/api/bookings/:id` | owner (DELETE: owner or admin) |

See [docs/DESIGN.md](docs/DESIGN.md) for requirements, the data model and architecture.

## Project structure

```
server/
  src/
    app.js              Express app factory (middleware, routers, error handler)
    db.js               Schema and transaction helper
    middleware/         JWT authentication, role guard, rate limiter
    routes/             auth, movies, theatres, shows, bookings
    validation.js       Input and seat validation
    seed.js             Demo data
  test/                 API integration tests
client/
  src/
    api/client.js       Fetch wrapper that attaches the bearer token
    context/            Auth state and helpers
    components/         SeatMap, ProtectedRoute, Navbar, ...
    pages/              Login, Register, MovieList, MovieDetails, SeatSelection, Bookings
    pages/admin/        Admin dashboard tabs
docs/DESIGN.md          Requirements and design
```

## Security notes

- Passwords are hashed with bcrypt. Login errors are generic and take the same time whether or not the email exists.
- JWTs are signed with HS256 (the algorithm is pinned on verification). On every request the user and role are reloaded from the database.
- Self-registration can only create `user` accounts.
- Users can only see and change their own bookings. Requests for another user's booking get a 404.
- All write endpoints validate their input. Failed logins are rate-limited.
- The token is kept in `localStorage` to keep the SPA simple. For production, consider httpOnly cookies with CSRF protection.
