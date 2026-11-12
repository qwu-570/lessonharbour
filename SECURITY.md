# Security Policy

## Supported version

Only the latest deployed version of LessonHarbour is supported.

## Reporting a vulnerability

Please do not disclose security vulnerabilities in a public GitHub issue. Contact the repository owner privately with reproduction steps, affected endpoints and potential impact. Avoid accessing, modifying or downloading data belonging to other users.

## Implemented controls

- Supabase email authentication with password-reset support
- HTTP-only authentication cookies
- Server-side role and record-ownership checks
- Same-origin validation for state-changing requests
- Bounded input validation and upload type/size checks
- Rate limits on authentication and sensitive writes
- Database uniqueness constraints for booking integrity
- Security response headers and restrictive Content Security Policy
- Private matching postcodes excluded from public tutor responses
- Secrets and local environment files excluded from source control

## Known limitations

- Tutor identity, qualifications and safeguarding documents are not yet verified
- Messaging does not yet include automated moderation or abuse detection
- Payments, disputes and refunds are not handled by the platform
- MyMemory may process published tutor biography text when DeepL is not configured
- The project is an evolving MVP and requires a security review before high-volume production use
