# Export section for a canvas selection

Only the frame editor exported, one frame at 1x or 2x. Now Export… in the
canvas menu takes any picked frames and rows of settings.

- export-rows.ts: a row is format, size by scale (0.5–4) or fixed width or
  height, suffix, quality (JPG/WebP only), transparent. Validated by zod.
- selection-export.ts: draws every frame for every row through ports;
  one file stays itself, several go in one zip (fflate).
- selection-export-ports.ts: the database, storage and Chromium side.
- Same path everywhere: canvas op export_selection (chat and MCP), page
  action exportSelection, `feega canvas export`.
- project-tools: the op list joins with ';' to keep the canvas chat
  prompt under its budget with the new op.

Not yet: SVG (text kept as text), multi-page PDF, export of a single
element inside a frame.

Guard: tests/e2e/canvas-export.spec.ts (two frames x two rows, real
zip of four PNGs).
