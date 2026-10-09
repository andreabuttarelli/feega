# e2e teardown purges storage recursively

`teardownE2eSession` listed only the top level of `canvas-assets/<org>/<project>`: files under
`imports/`, `music/`, `motion/`, `web-views/` and every other bucket (`brand-knowledge/<user>`,
`media/colours/<org>`, …) survived each real-stack run.

- `purgeStorage` (`tests/e2e/fixtures/storage-purge.ts`) walks every bucket under the org, user and
  colour-swatch prefixes and removes every file; Supabase is behind a three-method port so the walk
  is tested in memory (test in `scripts/e2e-storage-purge.test.ts`: Playwright loads every test file under `tests/e2e`).
