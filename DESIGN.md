# design

Feega's web app (`oh.feega.app`) is small: sign-in, the account and the dashboard. It follows one
taste: **a minimal look with real energy.** Few elements, a lot of space, confident type. The
tokens live in `src/app.css`; Tailwind exposes them in `src/lib/styles/tailwind.css`.

## the rules that never bend

| Rule | Value |
|---|---|
| Radius | **a scale, one role per step** (`--ui-radius-*`, Tailwind `rounded-xs/sm/md/lg`): `none` 0 for full-bleed panels and bars; `xs` 2px for kbd, checkboxes, swatches; `sm` 4px for buttons, inputs, rows; `md` 6px for menus, popovers, cards; `lg` 10px for dialogs and floating bars; `full` for avatars, dots, pills. Pick the step by role, never a free value. |
| Greyscale | a 13-step pure-grey ramp (`--grey-0…12`, light and dark) and semantic roles on top (`--ui-app`, `--ui-panel`, `--ui-input`, `--ui-divider`, `--ui-text*`). Components use roles, never a ramp step and never a hex. Every text role reads at WCAG AA on every surface role (`src/lib/greyscale-tokens.test.ts`). |
| Accent | one hue: `--ui-accent` for focus rings and selection, `--ui-accent-solid` under white text, `--ui-accent-text` for accent text. Nothing else is blue. |
| Borders | almost none. Separate with space and a slightly different surface; a hairline only where a boundary is functional (inputs). |
| Density | small, clean type, generous space, one primary action per view. |

## type

| Role | Style |
|---|---|
| Page titles | mega type, lowercase, first letter included: `clamp(40px, 4.5vw, 72px)` on desktop, tracking -0.04em, weight 600, line-height 0.95. Sign-in is the exception: small title. |
| UI text | BDO Grotesk, scale 11/12/13/15/20 (`--ui-text-xs…xl`). |
| Labels, ids | Fragment Mono (`--ui-mono`). |

## shell

The dashboard shell is the Feega mark, an account menu (name, email, Account, Sign out) and the
page. Primitives live in `src/lib/components/ui/`.
