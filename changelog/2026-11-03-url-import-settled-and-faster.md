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
- **Measured on the hosted browser** (dev server, Browserless, linear.app with breakpoints):
  desktop read 116 s (page prepared 45 s, tree 12 s, 46 element snaps ~50 s), tablet 111 s, phone
  68 s *after* tablet: 211 s per import, and desktop/tablet ended with 1–9 s left of the 120 s
  session, so a view was dropped as too slow on some runs (linear and stripe came in without
  breakpoints in the first verification). Tablet and phone now read at once in two pages of one
  session (`AppTab.beside`), still two sessions in all: 211 → 129 s, the rest of the import
  (fonts, plan, pictures, frames) 13 s. Tried and dropped: asking the browser for a snap's clip
  instead of a full viewport PNG cropped here. It did not move the time (the cost is the ~1 s round
  trip per snap, 46 on linear) and puppeteer's clip capture re-lays the page out beyond the
  viewport: linear's dark app mock-up came in as a white snap.
- Tests: `text-settle.browser.test.ts`, `import-url.test.ts` (no write during an import; views at
  once in one session).
