# ReelSeat — Requirements & Design

## 1. Problem statement

Build a movie ticket booking web application with role-based access. Customers browse movies,
pick a show, choose seats on a visual seat map and manage their bookings. Administrators manage
the catalogue of movies, theatres and show timings.

## 2. Functional requirements

| ID | Requirement | Role |
|----|-------------|------|
| FR-1 | Register an account and log in with email + password | Public |
| FR-2 | After login, redirect users to `/movies` and admins to `/admin` | All |
| FR-3 | List movies with search and genre filter | User |
| FR-4 | Movie details page with upcoming shows grouped by theatre | User |
| FR-5 | Interactive seat map per show showing available / booked / selected seats | User |
| FR-6 | Create a booking for one or more seats (max 10) | User |
| FR-7 | Booking history listing all of the user's bookings | User |
| FR-8 | Edit a booking (change seats for the same show) | User |
| FR-9 | Cancel / delete a booking, releasing its seats | User |
| FR-10 | Add and delete movies | Admin |
| FR-11 | Add and delete theatres (with seat-layout rows × columns) | Admin |
| FR-12 | Add and delete shows (movie + theatre + time + price) | Admin |
| FR-13 | View all bookings across users | Admin |

## 3. Non-functional requirements

- **Security**: passwords hashed with bcrypt; every protected API call requires a JWT bearer
  token; role checks on the server (UI hiding alone is never trusted); input validation on all
  write endpoints; users can only see/modify their own bookings.
- **Consistency**: a seat can never be double-booked. Enforced by a `UNIQUE(show_id, seat)`
  constraint on `booking_seats` and transactional writes.
- **Usability**: responsive layout, clear seat legend, error and loading states.
- **Portability**: zero native dependencies — the backend uses Node's built-in `node:sqlite`.

## 4. Architecture

```
┌──────────────────────┐   HTTPS / JSON + Bearer JWT   ┌──────────────────────────┐
│ React SPA (Vite)     │ ────────────────────────────▶ │ Express REST API         │
│  - AuthContext       │                               │  - auth middleware (JWT) │
│  - ProtectedRoute    │ ◀──────────────────────────── │  - role guard            │
│  - api client        │                               │  - validation            │
└──────────────────────┘                               └────────────┬─────────────┘
                                                                    │
                                                         ┌──────────▼──────────┐
                                                         │ SQLite (node:sqlite)│
                                                         └─────────────────────┘
```

### Data model

- `users(id, name, email UNIQUE, password_hash, role ∈ {user, admin}, created_at)`
- `movies(id, title, description, genre, language, duration_min, rating, poster_url, release_date)`
- `theatres(id, name, location, seat_rows, seat_cols)`
- `shows(id, movie_id → movies, theatre_id → theatres, start_time, price)`
- `bookings(id, user_id → users, show_id → shows, total_amount, created_at, updated_at)`
- `booking_seats(booking_id → bookings, show_id, seat, UNIQUE(show_id, seat))`

Deleting a movie or theatre cascades to its shows and their bookings.

### REST API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | – | Create user account, returns token |
| POST | `/api/auth/login` | – | Returns `{ token, user }` |
| GET | `/api/auth/me` | token | Current user |
| GET | `/api/movies` | token | List (`?q=`, `?genre=`) |
| GET | `/api/movies/:id` | token | Details + upcoming shows |
| POST | `/api/movies` | admin | Create movie |
| DELETE | `/api/movies/:id` | admin | Delete movie |
| GET | `/api/theatres` | token | List theatres |
| POST | `/api/theatres` | admin | Create theatre |
| DELETE | `/api/theatres/:id` | admin | Delete theatre |
| GET | `/api/shows` | token | List shows (`?movieId=`) |
| GET | `/api/shows/:id` | token | Show + seat layout + booked seats |
| POST | `/api/shows` | admin | Create show |
| DELETE | `/api/shows/:id` | admin | Delete show |
| GET | `/api/bookings` | token | Own bookings (admin: all) |
| POST | `/api/bookings` | token | Create booking `{ showId, seats[] }` |
| PUT | `/api/bookings/:id` | owner | Replace seats |
| DELETE | `/api/bookings/:id` | owner/admin | Cancel booking |

Seat identifiers are `<RowLetter><ColumnNumber>` e.g. `A1`, `C12`.

### Frontend routes

| Path | Access | Page |
|------|--------|------|
| `/login`, `/register` | public | Auth |
| `/movies` | user | Movie listing |
| `/movies/:id` | user | Movie details + shows |
| `/shows/:id/seats` | user | Seat selection (also used for editing via `?booking=`) |
| `/bookings` | user | Booking history |
| `/admin` | admin | Movies / Theatres / Shows / Bookings tabs |

## 5. Test strategy

- Backend: integration tests with `node:test` + `supertest` against an in-memory database
  covering auth, role guards, CRUD, double-booking prevention and booking ownership.
- Frontend: component tests with Vitest + Testing Library for the seat map and route guards.
- Manual smoke test of the full flow in the browser.
