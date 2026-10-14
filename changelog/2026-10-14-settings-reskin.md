# Settings and credits on the shell roles

Third area (after #555, #558). Settings pages are built on the shadcn-style `ui/*` kit, so the
kit carries most of the change:

- `ui/panel`: no border, `md` radius, sunken surface, no header rule; rows keep a divider (a
  functional boundary).
- `ui/input`, `ui/textarea`, `ui/select`: filled `--ui-input`, no border, `sm` radius, accent
  ring on focus, danger ring when invalid, 44px on touch.
- `ui/field`, `ui/notice`, `ui/badge`, `ui/empty-state`: type roles and role colours.
- `settings-shell.css` (`.bbtn`, cancel dialog, team/timezone inputs, API key list): roles,
  radius scale, primary on `--ui-accent-solid`, danger on `--ui-danger`. Its header comment
  went with it.
- Settings nav: 32px rows, `sm` radius, wash on hover/active, caps section labels.

Not touched: the overlay frame that hosts settings over the canvas belongs to the editor shell.
