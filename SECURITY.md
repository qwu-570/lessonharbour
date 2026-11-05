# Security Policy

## Supported version

Only the latest deployed version of the MVP is supported.

## Reporting a vulnerability

Do not publish security vulnerabilities in a public issue. Contact the repository owner privately with reproduction steps, affected endpoints and the potential impact.

## Implemented controls

- Managed authentication; LessonHarbour does not store passwords
- Server-side role and ownership checks
- Same-origin protection for state-changing requests
- Bounded JSON validation
- Authenticated write rate limits
- Parameterised database access through Drizzle
- Unique database constraints for booking integrity
- Security response headers and restrictive CSP
- Secrets excluded from source control

## Known MVP limitations

- No independent email/password login or password recovery
- No email verification beyond the managed identity provider
- No moderation or identity-verification workflow for tutors
- No payment processing
- No private-address exchange

These limitations must be reviewed before expanding beyond a controlled initial release.
