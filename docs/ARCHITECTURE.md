# LessonHarbour Architecture

## System

```text
Browser
  │ HTTPS
  ▼
Cloudflare Worker (Vinext)
  ├── React bilingual UI
  ├── REST API and authorization
  ├── Supabase Auth integration
  ├── R2 profile-photo storage
  └── optional translation and email providers
  │
  ▼
Supabase Postgres / PostgREST
```

The browser never receives the Supabase secret key. Email identities are verified from a Supabase access token stored in an HTTP-only application cookie. The hosting identity can also be accepted where the Sites environment supplies it. LessonHarbour then maps the identity to its own student or tutor account.

## Main data

- `users`: application role, display name and email
- `student_profiles`: required student name, private postcode and requested subjects
- `tutor_profiles`: subjects, biography, cached translation, price, lesson format, public location, private postcode, languages, photo and calendar-feed token
- `availability_slots`: tutor-owned lesson windows
- `bookings`: student, tutor, slot, status and cancellation data
- `messages`: conversations between students and tutors
- `rate_limits`: bounded counters for sensitive operations

Profile images are stored in R2 and served through a validated API route. Availability and booking timestamps are stored in UTC; the UI converts them using the selected IANA timezone.

## Security boundary

The browser and all request payloads are untrusted. Every protected write checks identity, role, ownership, origin, input bounds and rate limits on the server. Database access uses narrowly constructed PostgREST filters, and database uniqueness constraints protect booking integrity during concurrent requests.

Public tutor biography translation only accepts the biography of an already-published tutor. Generated Chinese text is cached in Supabase and invalidated when the original biography changes.

## Deployment

The hosted application is built as a Cloudflare Worker. Runtime secrets are configured in the hosting environment, not committed to Git. GitHub Actions independently runs tests, lint and a production build.
