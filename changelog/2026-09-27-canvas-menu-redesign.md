# Redesign the canvas burger menu

The burger menu in the canvas top bar (`CanvasMenu.svelte`) was a bare
dropdown: no header, no grouping, rows sized by content so long labels
wrapped ("Billing" under its icon on three lines), no credit balance,
no changelog link.

Rebuilt on the same `CANVAS_MENU_ITEMS` table, now carrying an explicit
`group` field (`navigate` / `help` / `account`) instead of a hand-picked
filter in the markup. The header shows the signed-in user (avatar or
initials, name, email, org) from `data.profile`/`data.org`, already
loaded by `+layout.server.ts` and now forwarded through `CanvasTopBar`
to `CanvasMenu`. Billing shows the live credit balance inline
(`CreditAmount`), reusing `creditBalance` already loaded for the top
bar's own credits pill.

Fixed width (260px), 36px rows, square corners, same paper/`--line-2`/
shadow language as the top boxes.

**Why the CSS fought back:** `tailwind.css` imports Tailwind with the
`important` modifier (documented in that file) so utilities beat the
app's global `* { margin:0; padding:0 }` reset. That also means
bits-ui's own Tailwind classes on `DropdownMenu.Content`/`Item`
(`w-(--bits-dropdown-menu-anchor-width)`, `gap-1.5`, …) carry literal
`!important` and beat a same-specificity `!important` in this
component's scoped styles. Two fixes: raise specificity with
`[data-slot='...']` attribute selectors for row layout, and set the
CSS custom property directly (`--bits-dropdown-menu-anchor-width: 260px`)
for width, since fighting a var-driven utility on the property itself
is unwinnable.

Verified against the real dev server with a disposable e2e user
(seeded/torn down like `tests/e2e/fixtures/session.ts`), Playwright
chromium at 1440px: menu open and the keyboard-shortcuts submenu open.
