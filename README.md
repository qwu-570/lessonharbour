# LessonHarbour

LessonHarbour is an open-source tutor discovery and lesson-booking MVP. It supports real authentication, student and tutor roles, tutor profiles, availability slots, booking requests, persistent Cloudflare D1 data, a REST API, automated tests and continuous integration.

## MVP scope

- Sign in with ChatGPT and persistent account onboarding
- Student and tutor role-based authorisation
- Published tutor profiles and subject filtering
- Tutor profile photos and spoken-language badges
- Direct JPEG, PNG or WebP profile-photo uploads
- Weekly repeated availability with 15-minute time increments
- Tutor availability management
- Student booking requests
- Tutor accept or reject workflow
- Database constraints that prevent duplicate slot bookings
- Same-origin write checks, validation, rate limiting and security headers

Payments, promoted tutors, VIP access, reviews, messaging, Google Calendar and native mobile apps are intentionally deferred.

## Architecture

- Next-compatible React application built with Vinext
- Cloudflare Worker runtime
- Cloudflare D1 and Drizzle ORM
- Sites-managed Sign in with ChatGPT
- REST endpoints under `/api`

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/API.md`](docs/API.md).

## Local development

Requirements: Node.js 22.13 or later.

```bash
npm ci
npm run db:generate
npm run build
```

Apply the generated D1 migration to the local preview database using the command documented by the Sites Vinext starter, then run:

```bash
npm run dev
```

The local Sites preview provides a mock Sign in with ChatGPT identity for loopback development.

## Quality checks

```bash
npm run test
npm run lint
npm run build
```

GitHub Actions runs the same checks for pushes and pull requests.

## Security

Please read [`SECURITY.md`](SECURITY.md). Never commit authentication tokens, API keys, `.env` files or production data.

## Licence

MIT. See [`LICENSE`](LICENSE).
