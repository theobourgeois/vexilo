# Email accounts

Email and password signup uses NextAuth's Credentials provider with JWT sessions. New signups remain in `vexilo_email_challenge` until the user enters the code sent through Resend. Account creation and code consumption happen atomically. Google sign-in remains available and requires Google's verified-email claim.

Before deploying, apply these migrations in order:

1. `drizzle/0010_unique_user_email.sql` enforces case-insensitive email uniqueness. Resolve any existing duplicate emails first.
2. `drizzle/0011_email_verification.sql` creates the pending verification table.

Set these server-only variables locally and in the deployment environment:

```env
RESEND_API_KEY=re_your_key
EMAIL_FROM="Vexilo <noreply@mail.vexilo.org>"
```

The sender domain must be verified in Resend. No email is sent if these variables are missing. Delivery failures leave a pending, inactive signup and let the user resend; they never activate an account. HTML and plain-text messages are generated in `src/lib/emails/verify-email.ts`.

Codes have six digits, expire after 10 minutes, and allow five attempts. Resending has a 60-second cooldown, rotates the challenge, and invalidates the earlier code. Code hashes are HMACs bound to the email and challenge using `NEXTAUTH_SECRET`. Pending passwords are salted hashes. Abandoned challenge records are purged after a day when a subsequent code is requested.

Older unverified password accounts must verify before signing in. Existing sessions are checked against the database before server actions, so unverified password accounts cannot continue posting through an older session. A pending signup cannot replace a verified or Google account.

The browser keeps only challenge metadata in session storage so verification survives refresh. Passwords stay in memory. After a refresh, successful verification returns the user to password sign-in. Password recovery is not included.

Passwords use salted scrypt (`N=32768`, `r=8`, `p=3`) and constant-time verification. Sign-in attempts and registrations are limited through the existing Redis connection; authentication fails closed if that connection is unavailable. Local Postgres development uses the in-memory Redis stand-in.

Run the password, input-validation, and callback-URL checks with:

```sh
npx tsx --test src/lib/password.test.ts src/lib/email-verification-code.test.ts
```

Database integration tests require an isolated local Postgres database whose name starts with `vexilo_verification_check_`. They intercept the Resend API and never send real email:

```sh
DATABASE_URL=postgres://postgres:postgres@localhost:5433/vexilo_verification_check_test npx drizzle-kit push --force
DATABASE_URL=postgres://postgres:postgres@localhost:5433/vexilo_verification_check_test npx tsx --test scripts/auth/email-verification.integration.test.ts
```
