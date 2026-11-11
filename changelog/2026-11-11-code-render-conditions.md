# Code import: render conditions (theme, width) as an explicit record

The import opened every page in a browser pinned to light, 1280 px, with no way to change it:
a dark-mode app was always imported light, and an edit could only ever be written as an inline
`style`, which beats a `dark:` class in dark mode.

`render-conditions.ts` now declares, in one place, the axes an imported screen can be rendered
under (`CONDITION_AXES`: switchable, applied, unsupported, each with its reason) and the
conditions themselves (`{ scheme, width }`). A request carries a list; every route is captured once
per condition, boards are named `/ · dark · 390px`, and each sourced clip carries `source.cond`
(absent for the base). The origin stores the list so a pull re-renders the same boards.

Write-back keys edits by element and condition. Dark in a Tailwind project becomes a
`dark:bg-[...]` class that replaces the previous `dark:` utility of the same family; the base
condition in a Tailwind project edits the unprefixed class, never an inline style that would
override `dark:`. Dark without Tailwind and any width other than desktop are skipped with a reason,
not guessed.

Discarded: linking tokens to feega variables (the browser resolves them; writing the token needs
a CSS parser per toolchain), forcing locale, auth, flags or loading states.
