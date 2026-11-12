# LessonHarbour · 良师港湾

An open-source, bilingual tutor discovery and lesson-booking platform for families and independent tutors — with no subscription and no hidden booking fees.

**Live site:** [lessonharbour-live-mvp.qling-wu.chatgpt.site](https://lessonharbour-live-mvp.qling-wu.chatgpt.site)

LessonHarbour is designed initially for overseas Chinese families, especially those looking for tutors in Southern England. It supports academic subjects and exam preparation (7+, 11+, 13+, GCSE and A-Level), as well as music, arts, coding and broader mentoring.

## Current features

- English and Chinese interfaces
- Email registration, sign-in, sign-out and password reset with Supabase Auth
- Separate parent/student and tutor accounts with server-side role checks
- Required student details for tutor matching
- Searchable tutor profiles with multi-level subjects, languages and uploaded photos
- Private postcode storage and public general location
- Recurring availability, 15-minute start intervals and timezone selection
- Calendar views and subscribable iCalendar feeds
- Booking requests with tutor accept, reject and cancellation workflows
- Free parent–tutor messaging
- In-product booking notifications and optional transactional email
- Automatic Chinese biography translation when a visitor switches to Chinese
- REST API, persistent Supabase Postgres data, automated tests and CI

Promoted tutors, VIP priority booking, payments, reviews, identity verification and native mobile apps are future work.

## Technology

- React 19 and TypeScript
- Vinext (Next-compatible routing and server components)
- Cloudflare Workers and R2 object storage
- Supabase Postgres, PostgREST and Auth
- Tailwind CSS
- Node's built-in test runner, ESLint and GitHub Actions

See the [Project plan](docs/PROJECT-PLAN.md), [Design evidence](docs/DESIGN-EVIDENCE.md), [Architecture](docs/ARCHITECTURE.md), [REST API](docs/API.md), [Security](SECURITY.md) and [Contributing](CONTRIBUTING.md).

## Run locally

Requirements: Node.js 22.13 or later and a Supabase project with the required schema.

```bash
git clone https://github.com/qwu-570/lessonharbour.git
cd lessonharbour
npm ci
cp .env.example .env.local
```

Fill in the Supabase variables in `.env.local`, then run `npm run dev`. Run the full quality check with `npm run check`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Browser-safe key used by server-side auth calls |
| `SUPABASE_SECRET_KEY` | Yes | Server-only database access; never expose to browser code |
| `DEEPL_API_KEY` | No | DeepL translation; MyMemory is used when absent |
| `CLOUDFLARE_EMAIL_API_TOKEN` | No | Transactional booking email |
| `CLOUDFLARE_ACCOUNT_ID` | No | Cloudflare account for email delivery |
| `EMAIL_FROM` | No | Verified sender address |
| `SITE_URL` | Recommended | Canonical production origin |

Profile-photo upload also needs an R2 bucket bound as `BUCKET` in the Cloudflare Worker environment.

## Database setup

The application accesses Supabase through server-side PostgREST calls. Create the tables and RPC functions represented by the project's schema/migration files before running the complete application. Keep the secret key only in server-side environment configuration.

The historic Drizzle migrations are retained for schema reference while the hosted application uses Supabase as its persistent database.

## Quality and CI

```bash
npm run test
npm run lint
npm run build
```

The workflow in `.github/workflows/ci.yml` runs these checks for pushes to `main` and pull requests.

## Security and privacy

- Never commit `.env` files, secret/service-role keys, tokens or production data.
- Tutor and parent postcodes are private matching data and are not returned in public profiles.
- State-changing requests use same-origin checks, validation, role/ownership checks and rate limits.
- Public biography translation sends published biography text to DeepL or MyMemory.

Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Licence

Released under the [MIT License](LICENSE).
