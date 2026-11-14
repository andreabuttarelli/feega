# The credits and team pages, looked at for the first time

The €9-per-editor plan, editor seats, the weekly agent-edit cap and the permissions hardening were
tested at route level and in pglite, but nobody had seen `/app/credits` or `/app/team` rendered.
They were put in a real Chrome — real page components inside the real app shell, fed by the real
`load`/API handlers on the in-memory database with a fake Stripe — and every billing state was
looked at in light, dark, 1440 and 390 px. What was visibly wrong:

- **Credits page silent on a failed payment.** Past due and unpaid showed "Current plan" as if all
  was well. It now leads with an error notice (`paymentNotice` in `team-seat-copy.ts`, shared
  with the team page's unpaid sentence).
- **"1 editors".** `planTotal` and `cancelWarning` use ICU plurals; `membersLine` and
  `planEndNotice` count in the singular, and the plan-end notice no longer promises "0 editors
  become viewers" when the owner is the only editor. The credits page's own `planEnds` string
  was a copy of `planEndNotice`; it now uses the function.
- **A retired €8 plan quoted "/ editor / month".** It reads `€8 / month` (`planFlat`).
- **Subscribe double-click opened two Stripe Checkout sessions.** `apiEnhance` ignores a submit
  while the previous one is in flight, and stays locked once it has handed the tab to an external
  URL. Every dashboard form gets it.
- **Ownership transfer lied.** The confirm said "You become an admin" while a free team made the
  old owner a viewer, and on a per-editor team it silently added a paid seat. `transferPrompt`
  says which, before confirming.
- **Team refusals showed raw codes** (`already_invited`) or the CLI sentence with a bare
  `/app/credits` path, in red, for what is an upsell. `refusalNotice` maps codes to words; seat
  refusals reuse the editor hint as an info notice. The team page's own buttons are disabled while
  a write is in flight, so a double Enter does not send two invites.
- **Team page layout.** It had no page column (title touching the first panel, 16 px edges on a
  phone), native `<select>`s 18 px tall in a larger font than the page, and member rows where the
  role select overlapped the email at 390 px. It now uses the credits page's column, the UI
  `Select` (32 px, 44 px on touch) and rows that wrap.
- **Chat banner at the agent-edit cap** said "Get credits" — buying credits does not lift the cap.
  It says "Subscribe" (`FAILURES.agentCap.linkKey`).

Not changed, and why: role names stay `member`/`admin`/`viewer` in the selects (renaming
`member` to `editor` is a product decision); a zero balance shows `0` without an "out of credits"
line on the credits page; the at-cap row reads `1,000 / 1,000` with no emphasis.
