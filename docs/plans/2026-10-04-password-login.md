# Password login with conditional identity verification

## Authorized scope

The user requested replacing primary OTP sign-in with username/password and requesting OTP when sign-in is abnormal. The later instruction to update Login was followed by explicit confirmation that email is the username. This supersedes the previous UI-only auth guardrail, while retaining the unified Tablet/Mobile surface and transparent Login logo.

## Implemented decisions

1. Email is the username, preserving existing Auth user IDs and application data.
2. A new/unverified browser receives email OTP only after a valid password. A random, server-verified trusted-browser credential lasts 30 days and is invalidated by a password change. This starting policy does not detect location anomalies or impossible travel and is not native Supabase `aal2` MFA.
3. The Custom Access Token hook issues a restricted `kemtit_pending` role and zero UUID subject for unapproved sessions. This blocks direct Auth credential changes as well as database/storage access before verification. The real user identity is taken only from successful native Auth responses and is bound to the live session by service-only approval RPCs.
4. Only hashes of browser/challenge credentials and a private email HMAC are stored. Challenges expire after 10 minutes, admit at most five atomic attempts, enforce a 60-second email cooldown and reject cross-purpose/cross-user use and replay.
5. Signup eligibility is recorded before native OTP account creation. New native OTP users already have an internal password hash; neither hash emptiness nor account age authorizes password setup. Existing accounts use verified email recovery/setup and retain the same ID.
6. After a verified signup/recovery challenge is consumed, Admin password update revokes its OTP session. A fresh native password sign-in must return the same verified user and a valid pending session; only that new session is approved and refreshed. The old OTP refresh token is never reused.
7. Google callback approval requires the native OAuth authentication method and a Google identity, including an existing email account with a linked Google identity. Cookie-supplied user metadata cannot approve a session.
8. New passwords require at least eight characters and no more than 72 UTF-8 bytes, matching the locally measured Auth provider limit. Existing password sign-in keeps compatibility with existing credentials.

## Application changes

- Password/default, conditional OTP and password recovery/setup states use the existing Login shell and pure Thai/English copy. Password show/hide, safe destination routing, loading and error handling are retained.
- Registration collects name, email and confirmed password, verifies email OTP, sets the password and approves a fresh session before saving the profile under existing authorization/RLS.
- `getMe` and existing owner RLS remain unchanged. The proxy treats only the `authenticated` role as signed in; public registration actions remain available to signed-out users.
- Local migrations backfilled existing sessions before the hook was activated. No reset or hosted deployment was performed. Hosted rollout requires the migrations, hook, six-digit recovery template, outbound email and deployed auth verification together.

See [verification and native provider audits](../qa/password-login/QA.md) for current results, including the regression found and corrected by testing real password changes.

## Impact audit

GitNexus on Kemtit.com in this checkout:

- `requestOtp`: LOW, six upstream symbols; directly called by login/register `sendCode`. Registration flows are affected.
- `verifyOtp`: LOW lower-bound, two direct submit handlers and four recorded registration flows. One receiver call site is unresolved; verify text references before editing/removing behavior.
- `getMe`: **CRITICAL**, 17 direct callers, 21 upstream symbols and 17 affected process groups. It guards application/onboarding/settings/planner surfaces. Its security contract must remain compatible.

The `getMe` contract was preserved. Previous UI-only verification is recorded separately in `docs/qa/login-lifestyle/QA.md`; final password-flow verification is recorded in the linked QA report.

## Primary references checked

- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase MFA and enforcement](https://supabase.com/docs/guides/auth/auth-mfa)
- [Supabase password verification hook](https://supabase.com/docs/guides/auth/auth-hooks/password-verification-hook)
