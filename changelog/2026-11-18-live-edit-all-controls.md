# Every Properties control writes to code

Live edit wrote only text, colours, type size/weight, padding, gap and radius; every other
control in the Properties tab moved the element on the canvas and changed nothing in the file.

The code export (`buildPage`) already turns a clip into CSS. `live-class-rows.ts` builds the
one-element doc inside a parent, diffs the exported CSS before and after, and maps each changed
property to a Tailwind class through one table (`CSS_ROWS`); properties the export does not
cover (position, size, flip, hide, decoration, truncation) are read from the clip
(`DIRECT_ROWS`). A CSS property with no row becomes an arbitrary-property class. Families of
classes and which tokens each owns live in `CLASS_FAMILY` (`live-fields.ts`), shared by client
and server, together with the breakpoint selection (`activeIndex`).

Returning a control to its starting value writes the element's original class back, not an
empty one. A change with no CSS (constraints) reports "no equivalent in CSS" instead of
silently doing nothing. The server accepts an empty class (removal) and a no-op edit.

Also: two merges registered `feega github variant` twice and the CLI no longer started; the
version command is now `feega github version-variant`, with a test that fails on duplicates.

Not verified in a browser: the Next.js and Vite React apps cloned for the test were not run
(permission to run third-party dev servers was denied); `feega init` and `npm install` of
`feega-source-map@0.1.0` from npm succeeded on both.
