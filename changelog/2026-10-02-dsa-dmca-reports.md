# DSA and DMCA notice-and-action

Before: TERMS §12 asked reporters to email support@feega.app; nothing recorded a
report, a decision or a strike, and nothing sent a statement of reasons.

Now:

- `/report` (public, no login, no cookies): one form, fields driven by the reason
  table in `src/lib/reports/reasons.ts` — illegal content (DSA art. 16), DMCA
  (§512(c)(3)), likeness/voice, CSAM (no identity). Linked from `/s/[token]`,
  the node toolbar overflow ("Report content") and the burger menu.
  Spam: honeypot field + 5 reports/hour per hashed IP (counted on
  `content_reports.reporter_fingerprint`; the raw IP is never stored).
- Tables `content_reports` and `account_strikes` (migration
  `20261002160000_content_reports.sql`, applied to klnswzhhgrqvbfjzioul via MCP).
  RLS on, no policies, privileges revoked from anon/authenticated: only the
  service-role path declared in `service-role-uses.ts` reads them.
  `org_id` is nullable: a report about a URL we cannot resolve has no org.
  `database.types.ts` entries were written by hand — `db:types` failed
  (project over egress quota); regenerate when it is back.
- `/admin/reports`: 404 unless `isInternalEmail`. Decisions come from
  `DECISION_EFFECTS` (content/strike/account per decision) and need a ground
  from `GROUNDS` (law or terms clause) plus a note that goes to the user.
  Remove = node soft-deleted + public token cleared + canvas share revoked
  (token kept on the report so Restore can bring it back). Assets have no
  `deleted_at`, so they stay in storage — also what evidence preservation needs.
- Strikes (`strikes.ts`): weight by reason, thresholds 1 warning, 2 suspension
  (Supabase auth ban 30 days), 3 termination (permanent ban). Restore revokes
  the strike and recomputes.
- Emails (`report-emails.ts`, via `sendEmail`): receipt, decision to reporter,
  DSA art. 17 statement of reasons to the affected user, DMCA notice forward +
  counter-notice link (token, stored hashed), counter-notice forward to the
  claimant, URGENT escalation to `INTERNAL_EMAILS` (CSAM, threat to life).
- Counter-notice `/report/counter/[id]?t=`: sets `restore_after` = +10 business
  days; the canvas tick restores due cases unless "Claimant filed suit" was
  pressed.
- `internalEmails()` in `internal-users.ts` is now exported (escalation
  recipients).
- TERMS §12 points to the form; new §12A (DMCA), `DMCA.md`,
  `docs/legal/serious-crime-escalation.md`, checklist items (register the DMCA
  agent, copy to Framer).

Discarded: a `profiles.suspended_at` column checked on every request — the auth
ban already blocks sign-in and refresh without a query per request (the current
access token lives until expiry, at most one hour).
