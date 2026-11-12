# Landing: "Design in your codebase" section and page

The hero said "Design inside your code" and nothing below showed it. The home now has a section
after "Start from any site", and `/design-in-your-codebase` repeats it with a closing call to
action: a headline, one line, two actions (import, read the docs), an isometric loop, three steps
with their own isometric glyphs, and one row of framework logos.

The first version was a spec sheet (capability tables, React 18/19 caveats, route limits). It was
rejected as too technical: those details live in the docs page it now links to.

The loop is inline SVG in true isometric projection (`codebase/iso.ts`, 30° axes, one light
direction): a code plane, page layers lifting out of it, a theme switch that turns them dark, the
layers folding back and a pull-request tile rising from the code. CSS transforms and opacity
only, 10 s cycle, paused off screen by an IntersectionObserver; with reduced motion it shows the
lifted, light composition. No animation library, no raster assets.

Frameworks: the four measured on real apps in `docs/specs/code-import.md` (Next.js, SvelteKit,
React + Vite, Vue + Vite) are named; the rest of `FRAMEWORKS` in `run-plan.ts` are quieter marks
under "and more in early support". Not advertised: `npx feega` in a project folder and the
VS Code / Cursor extension (#1992 is not merged).

Logos are simple-icons paths (CC0) inlined in `codebase/logos.ts`: `simple-icons` is a
dependency of the app, not of `landing/`. No public changelog entry: the product did not change.
