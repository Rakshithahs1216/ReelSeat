# ReelSeat API Reference

Base URL: `http://localhost:4000/api`

All request and response bodies are JSON. Every endpoint except `/health`, `/auth/register` and `/auth/login` requires this header:

```
Authorization: Bearer <token>
```

## Errors

Every error uses the same shape:

```json
{ "error": "Validation failed", "details": { "email": "must be a valid email" } }
```

`details` is included only for validation errors (field name → message) and seat conflicts (`{ "conflicts": ["B5"] }`).

| Status | Meaning |
|--------|---------|
| 400 | Invalid input, malformed JSON, invalid seat, or show already started |
| 401 | Token missing, invalid or expired, or wrong login credentials |
| 403 | Logged in but the role is not allowed (for example, a user calling an admin endpoint) |
| 404 | Not found, or a booking that belongs to someone else (its existence is not revealed) |
| 409 | Seat already booked, or email already registered |
| 429 | Too many failed login or registration attempts (see the `Retry-After` header) |

## Auth

### `POST /auth/register`
Creates a **user** account. Any `role` field in the body is ignored.

```json
{ "name": "Priya Sharma", "email": "priya@example.com", "password": "password123" }
```
Returns `201 { "token": "...", "user": { "id": 3, "name": "Priya Sharma", "email": "priya@example.com", "role": "user" } }`

Rules: name is 2–80 characters, email must be valid, and password is 8–72 characters (at most 72 bytes).

### `POST /auth/login`
```json
{ "email": "admin@reelseat.com", "password": "Admin@123" }
```
Returns `200 { "token": "...", "user": { ..., "role": "admin" } }`. The client sends the user to a page based on `user.role`.

### `GET /auth/me`
Returns `{ "user": { "id", "name", "email", "role" } }`.

## Movies

| Method | Path | Access | Notes |
|--------|------|--------|-------|
| GET | `/movies?q=&genre=` | token | Optional search by title and filter by genre (case-insensitive) |
| GET | `/movies/:id` | token | Movie fields plus `shows[]` (upcoming only, with theatre name and location) |
| POST | `/movies` | admin | Returns `201` with the created movie |
| DELETE | `/movies/:id` | admin | Returns `204`. Also deletes the movie's shows and their bookings |

Movie body:
```json
{
  "title": "Orbitfall",          // required, max 150 characters
  "duration_min": 155,           // required, 1-600
  "genre": "Sci-Fi, Adventure",
  "language": "English",
  "rating": "UA",
  "release_date": "2026-10-21",  // YYYY-MM-DD
  "poster_url": "https://...",   // http(s) only
  "description": "..."
}
```

## Theatres

| Method | Path | Access | Notes |
|--------|------|--------|-------|
| GET | `/theatres` | token | |
| POST | `/theatres` | admin | `{ "name", "location", "seat_rows": 1-26, "seat_cols": 1-30 }` |
| DELETE | `/theatres/:id` | admin | Also deletes the theatre's shows and their bookings |

Seats are named `<row letter><column number>`, for example `A1` or `J14`.

## Shows

| Method | Path | Access | Notes |
|--------|------|--------|-------|
| GET | `/shows?movieId=` | token | Includes movie title and theatre details |
| GET | `/shows/:id` | token | Show details, seat layout (`seat_rows`, `seat_cols`), `booked_seats[]`, and `my_seats[]` (the caller's own seats, with booking IDs) |
| POST | `/shows` | admin | `{ "movie_id", "theatre_id", "start_time": ISO-8601 (future), "price" }` |
| DELETE | `/shows/:id` | admin | Also deletes the show's bookings |

`booked_seats` lists only seat codes. It never says who booked them.

## Bookings

| Method | Path | Access | Notes |
|--------|------|--------|-------|
| GET | `/bookings` | token | The caller's bookings. Admins get every booking |
| GET | `/bookings/:id` | owner or admin | |
| POST | `/bookings` | token | `{ "showId": 8, "seats": ["C5", "C6"] }`, 1–10 seats |
| PUT | `/bookings/:id` | owner | `{ "seats": [...] }` replaces the seats. The booking's current seats can be kept |
| DELETE | `/bookings/:id` | owner or admin | `204`. Users can only cancel bookings for shows that haven't started |

Booking response:
```json
{
  "id": 1, "show_id": 8, "user_id": 2,
  "seats": ["C5", "C6"], "total_amount": 540, "price": 270,
  "start_time": "2026-11-05T04:30:00.000Z",
  "movie_id": 2, "movie_title": "The Clockmaker of Mysuru", "movie_poster": "https://...",
  "theatre_name": "Galaxy Multiplex - Screen 1", "theatre_location": "MG Road, Bengaluru",
  "user_name": "Demo User", "user_email": "user@reelseat.com",
  "created_at": "...", "updated_at": "..."
}
```

How seat booking stays correct:
- Seats must exist in the theatre layout, and leading zeros are rejected (`A01` is invalid).
- Duplicate seats in one request are rejected.
- Creating or editing a booking runs in a single transaction. If any requested seat is taken, the request fails with `409` and nothing is written.
- A `UNIQUE(show_id, seat)` constraint in the database is a final guard against double booking.

## Example session

```bash
API=http://localhost:4000/api
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"user@reelseat.com","password":"User@1234"}' | jq -r .token)

curl -s $API/movies -H "Authorization: Bearer $TOKEN" | jq '.[].title'
SHOW=$(curl -s "$API/shows?movieId=3" -H "Authorization: Bearer $TOKEN" | jq '.[0].id')
curl -s -X POST $API/bookings -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"showId\":$SHOW,\"seats\":[\"E6\",\"E7\"]}" | jq '{id, seats, total_amount}'
```
