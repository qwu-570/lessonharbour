# LessonHarbour REST API

All responses are JSON. Authenticated endpoints use the visitor's hosting-platform identity. Write requests must be same-origin and use `Content-Type: application/json`.

## Identity and account

- `GET /api/me` returns the current identity, LessonHarbour account and tutor profile.
- `POST /api/account` creates a student or tutor account after first sign-in.

## Tutors

- `GET /api/tutors?subject=Mathematics` lists published tutor profiles.
- `GET /api/tutors/:id` returns one profile and its available future slots.
- `POST /api/tutor-profile` creates or replaces the authenticated tutor's profile.
- `PATCH /api/tutor-profile` updates the authenticated tutor's profile.

## Availability

- `GET /api/availability` lists the authenticated tutor's slots.
- `POST /api/availability` creates a future slot lasting 30 minutes to 3 hours.
- `DELETE /api/availability/:id` deletes an unbooked slot owned by the tutor.

## Bookings

- `GET /api/bookings` lists bookings belonging to the authenticated user.
- `POST /api/bookings` lets a student request an unbooked future slot.
- `PATCH /api/bookings/:id` lets the owning tutor accept or reject a pending request.

## Common status codes

- `200` successful read or update
- `201` record created
- `400` invalid input
- `401` sign-in required
- `403` wrong role, incomplete onboarding or cross-origin write
- `404` record not found or not owned by the requester
- `409` uniqueness or state conflict
- `415` request is not JSON
- `429` rate limit exceeded
