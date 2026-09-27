# Invites are accepted

Before: settings/team wrote `orgs_invites` rows and emailed `/login?invite_token=…`,
but no route read the token. `acceptInviteWith` existed with no caller.

Now `landingPath` (`src/lib/server/tenancy/landing.ts`) is the single post-auth
destination: with a token it calls `acceptInvite`, then lands in the inviting org's
most recently updated project; without one it is `homePathFor` with the cookies.

The token rides every path: hidden `invite_token` field on the password/signup/GitHub
forms, the OAuth `redirectTo` query (`/auth/callback`), the recovery email's `next`
(`/auth/reset-password?invite_token=…`), and `/login` load for a signed-in visitor.

Policy: the account email must equal the invited email (case-insensitive), else
`wrong_email` and the invite stays unspent. Missing, expired and spent-by-someone-else
all answer `invalid` (no enumeration). Failures land on `/login?invite_error=<code>`,
which renders the message instead of redirecting a signed-in user.

No magic-link sign-in exists today; `/auth/callback` covers it if it returns.
Invite copy on /login is English-only: `src/lib/i18n` was owned by a parallel task.

Found in the browser run: a brand-new signup hit a 500 because `orgs_members.user_id`
references `profiles`, and the profile was only created later by `enterApp`.
`landingPath` now calls `ensureProfile` before `acceptInvite`.
