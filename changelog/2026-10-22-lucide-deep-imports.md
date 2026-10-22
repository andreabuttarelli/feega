# Lucide deep imports

Seven files imported from the `@lucide/svelte` barrel, so Vite transformed all ~1,700 icons in
client and SSR builds and rollup then dropped them. They now import `@lucide/svelte/icons/<name>`
like the rest of the code.

- `scripts/no-lucide-barrel.test.ts` fails if the barrel comes back. No eslint in this repo, so
  a test holds the rule instead of `no-restricted-imports`.
- Public changelog skipped: invisible from outside.
