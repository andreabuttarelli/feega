# Dashboard on the shell roles

The editor moved to the greyscale roles and the radius scale (#549); the dashboard did not, so
leaving the editor looked like changing app.

- `AppShell`, `AppSidebar`, home, `/app/canvases`, `CanvasRows`, `HomeHero` read role tokens
  (`--ui-panel`, `--ui-panel-sunken`, `--ui-wash`, `--ui-text-*`) instead of the legacy
  `--ui-ink/--ui-hover/--ui-field` aliases.
- Radius by role: rows and buttons `sm`, cards and the account menu `md`, the prompt dock `lg`,
  avatars and suggestion chips `full`.
- The account menu is a raised surface with the float shadow; nav rows are 32px (44 on touch).
- `ui/button` variants use the roles: primary is `--ui-accent-solid` (AA under white; `--ui-accent`
  was 3:1), secondary a filled input, no borders. Every page that uses `Button` inherits it.
- New `PageHeader` (mega title, lede, actions): the one header pattern for app pages.
- The prompt dock lost its accent border on focus: the caret already says where focus is.

No behaviour, action or test id changed.
