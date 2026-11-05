# LessonHarbour Architecture

## System

```text
Browser
  |
  | HTTPS
  v
Cloudflare Worker and Vinext
  |-- React pages
  |-- REST API
  |-- server-side authentication and authorisation
  |
  v
Cloudflare D1
```

Tutor profile photos are stored in the Site's private R2 bucket and served through a validated read endpoint. Only authenticated tutors can upload images.

Authentication is supplied by the hosting platform through verified identity headers. On first sign-in, the visitor creates either a student or tutor record. API routes read the authenticated identity on the server and separately verify the application role and record ownership.

## Data model

- `users`: stable identity, display name, email and application role
- `tutor_profiles`: subject, biography, price, format, location, profile photo URL, spoken languages and publication state
- `availability_slots`: tutor-owned start and end times
- `bookings`: student, tutor, slot and status
- `rate_limits`: bounded counters for authenticated write operations

The database has a unique constraint on `bookings.slot_id`, preventing two booking records for the same lesson slot even during concurrent requests.

## Security boundary

The browser is untrusted. UI visibility never grants permission. Every write endpoint:

1. Requires a verified identity.
2. Loads the application account from D1.
3. Checks its role and record ownership.
4. Validates the request body.
5. Applies an authenticated rate limit.
6. Uses parameterised Drizzle queries.

The Worker adds a restrictive Content Security Policy, clickjacking protection, MIME sniffing protection, a permissions policy and a referrer policy.

## Deferred architecture

Calendar, payment, messaging and notification services are not part of the MVP. They should be added as isolated integrations after the booking journey is stable.
