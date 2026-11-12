# Contributing to LessonHarbour

Thank you for helping improve LessonHarbour.

## Development workflow

1. Fork the repository and create a focused branch.
2. Install dependencies with `npm ci`.
3. Copy `.env.example` to `.env.local` and add your own development credentials.
4. Make a small, documented change.
5. Run `npm run check` before opening a pull request.

Do not commit API keys, Supabase secret keys, personal information, production database exports or real user messages.

## Pull requests

Describe the user problem, the change, how it was tested and any database or environment-variable changes. Add or update tests for business rules where practical. Keep unrelated formatting or refactoring out of feature pull requests.

## Reporting bugs

Include reproduction steps, expected behaviour, actual behaviour, browser/device information and screenshots with personal data removed. Security vulnerabilities must be reported privately according to `SECURITY.md`, not in a public issue.
