# Contributing

Pull requests are welcome under Apache-2.0, no CLA.

## Layout

- `inspect/`, `npx/`: the VS Code extension and `npx feega`.
- `packages/source-map`: the dev plugin that maps DOM nodes to source.
- `src/`: the web app at `oh.feega.app` (sign-in, account, dashboard, billing).
- `landing/`, `web-docs/`, `web-blog/`: the sites.
- `supabase/`: migrations. They are immutable: never edit, rename or delete one.

## Setting up

You need Node >= 22.

```bash
cp .env.example .env     # point PUBLIC_SUPABASE_URL and the keys at your own Supabase project
npm install
npm run dev              # http://localhost:5173
```

Migrations are applied by hand, and deploys do not run them. After writing a migration, and
before any change that touches the database:

```bash
node scripts/schema-drift-check.mjs   # read-only, anon key, zero rows; exits 1 on drift
```

## Tests

```bash
npm run test:unit    # the whole vitest suite
npm run check        # svelte-check
```

## Pull requests

1. Branch from an up-to-date `dev` and open the PR against `dev`.
2. Write the failing test first when fixing a defect.
3. Keep code free of comments: rename and restructure instead.
4. Say in the PR body what you ran and what you did not.
