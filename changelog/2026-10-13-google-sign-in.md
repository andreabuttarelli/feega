# Google sign-in back on /login

Restores the `?/google` form hidden on 2026-09-27; the action and
`/auth/callback` were never removed. Provider is enabled on Supabase.

- `/auth/callback` now maps a provider error (`?error=access_denied`,
  cancelled consent) to `/login?error=oauth` instead of a silent
  `/login`.
- `/login` load reads `?error=oauth|link` (`sign-in-error.ts`) and the
  page shows it; `?error=link` was already emitted and never displayed.
- OAuth buttons disable while the browser leaves for the provider.
- New Google users reach their canvas through the same `landingPath` →
  `homePathFor` → `enterApp` bootstrap as email signups.
