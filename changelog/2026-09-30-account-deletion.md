# Self-serve account deletion and data export

**Why.** GDPR art. 17 and 20 (legal review): deleting an account needed an
email to us; exporting data had no path at all.

**What changed.**
- Settings → Profile → "Delete account": type `DELETE` or the email; login
  must be under 15 minutes old (`signedInRecently`), else "sign in again".
- `deleteAccountWith` (`src/lib/server/account/delete-account.ts`):
  `planDeletion` refuses when the user is the only owner of an org with other
  members (transfer first); orgs where the user is the only member are
  deleted, their Stripe subscription cancelled at period end first (a Stripe
  failure aborts before anything is deleted).
- SQL `delete_account(p_user)` (migration `20260930120000`, service_role
  only), one transaction: re-checks the owner rule, deletes sole-member orgs,
  chat threads the user started, personal NSFW opt-ins, nulls every
  `actor_id`-style reference in shared orgs (NO ACTION FKs would otherwise
  block), writes `account_deletions` (counts only, no ids), deletes
  `auth.users` → cascades profile, memberships, API keys, age verification.
- Storage removed after the transaction, 3 attempts each: `brand-knowledge`
  and `media` under `${userId}/`, `canvas-assets` and `influencers` under each
  deleted org.
- "Download my data": `GET /account/export`, user JWT (RLS), JSON with
  profile, memberships, orgs, projects metadata, chat messages the user wrote,
  credit ledger of owned orgs.
- Service-role use declared in `service-role-uses.ts`.

**Discarded.** Async export by email: the payload is small; direct download
is simpler. A scheduled storage sweeper: retries inline suffice today; a
failed prefix is logged.

**Note.** `account_deletions` has no `org_id` by design: it must survive the
org it counts. `database.types.ts` entries were added by hand (CLI
`db:types` returned Unauthorized); regenerate when possible.
