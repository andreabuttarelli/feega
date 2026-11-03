# URL import reads finished text and writes each frame once

From the import audit (round 2).

- **Text mid-animation.** vercel's "For coding agents" came in as "lpgjvoding agents": a scramble
  effect was still writing the heading when the page was frozen. `settle` (network quiet, fonts)
  now also waits until `document.body.innerText` stops changing between two 150 ms polls, at most
  2.5 s, so a text effect is read finished. A page whose text never stops (a clock) costs 2.5 s
  per settle.
- **Import time.** Local reads take 15–19 s per width (linear, stripe); the audit's 80–143 s were
  mostly the server writing: the page doc (2.4 MB on linear/stripe) was created, then read and
  written again to home its mains, then again to fill its pictures, and every component set frame
  the same (30 sets on linear/stripe). Pictures are now imported first, set frames get their ids
  before they exist (`placeFigmaPlan` takes ids), and every frame is created once already homed
  and filled: no `store.write` during an import. Sets land before the page, so the page only
  points at sets that landed; any failure still removes every frame placed.
- Breakpoint views still read one after the other next to the desktop read: the Browserless plan
  admits two sessions (`de52077fe`).
- Tests: `text-settle.browser.test.ts`, `import-url.test.ts` (no write during an import).
