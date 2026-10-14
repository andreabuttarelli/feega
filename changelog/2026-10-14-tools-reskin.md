# Tools and templates on the shell roles

Second area after the dashboard (#555). Same token move, applied to `/app/templates`,
`/app/tools`, studio (both steps), compose (list and editor page), upscale, `/app/motion`, the
gallery and the shelves/components they render.

- Legacy aliases (`--ui-ink*`, `--ui-field`, `--ui-hover`, `--ui-text-2/3`, `--ink*`, `--paper*`,
  `--line*`) replaced with roles. `--ui-text-3` was 40% alpha ink: under AA on every surface;
  `--ui-text-tertiary` passes.
- `--ui-accent` under white text became `--ui-accent-solid`, as accent text `--ui-accent-text`
  (both AA). Selection outlines keep `--ui-accent`.
- Radius by role: buttons, inputs, chips' segments `sm`; cards, drop zones, panels `md`;
  filter chips stay `full`. Upscale's size/mode toggles read as a segmented control (sunken
  track, raised choice).
- Templates and tools use `PageHeader`; shelf headings use the section label.

Not done: the 1px card borders on `/app/motion` and compose stay; DESIGN.md wants surfaces
instead. A second pass, with the editor-side owner, since `PhotoDrop` is theirs (#549).
