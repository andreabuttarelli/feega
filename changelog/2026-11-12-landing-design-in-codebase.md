# Landing: "Design in your codebase" section and page

The hero said "Design inside your code" and nothing below explained it. The home now has a
section after "Start from any site" with the loop as three steps (Code → Design → Code), the
frameworks code import recognises, and the token sources it reads; `/design-in-your-codebase`
spells out what comes across, where it comes from and what goes back. Linked from the home
section and the footer, listed in the sitemap and llms.txt, covered by the SEO length test.

Frameworks come in two tiers. "Tested" are the four measured on real apps in
`docs/specs/code-import.md` (Next app router, React + Vite, SvelteKit, Vue + Vite); the rest of
`FRAMEWORKS` in `run-plan.ts` are "Early support": detected and started, not measured. Every
claim maps to code: write-back of text and style only where a source location exists (Svelte 5,
React 18), tokens per mode everywhere, variants only for React and Vue, up to 8 routes.

Not advertised: `npx feega` in a project folder and the VS Code / Cursor extension (#1992 is not
merged), automatic page discovery, the full component library, env vars and login-protected pages.

Logos are simple-icons paths (CC0) inlined in `landing/src/lib/site/codebase/logos.ts`:
`simple-icons` is a dependency of the app, not of `landing/`. No public changelog entry: the
product did not change.
