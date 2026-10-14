# Auth, share, errors, changelog, docs on the shell roles

Fourth area (stacked on #562). These pages still carried the old violet `--accent` (links,
focus halo, the dark-mode CTA) and bordered square boxes.

- `/login`, `/auth/reset-password`: filled inputs, `sm` radius, accent ring on focus, the CTA on
  `--ui-accent-solid` in both themes; the separate dark-mode overrides are gone (roles flip
  themselves). Links read `--ui-accent-text` (AA).
- `+error.svelte`: no card, mega lowercase title, role buttons. Covers 404/500 everywhere,
  including `/s/[token]` for a dead link.
- `/s/[token]`, `/changelog`, docs layout, `/report`, `/status`, the onboarding dialog: legacy
  tokens to roles, accent fixes, radius by role.

Not done: the changelog hero keeps its sentence-case title; it is a public page, not an app view.
