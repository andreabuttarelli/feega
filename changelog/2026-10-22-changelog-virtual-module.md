# Changelog entries as one virtual module

The public changelog was 1,231 files pulled in by an eager `import.meta.glob`: Vite transformed
each one in client and SSR builds.

- `scripts/changelog-entries.ts` bundles the files with esbuild into `virtual:changelog-entries`,
  newest file name first, same order as before. Vite sees one module.
- One file per entry stays the authoring rule. Editing an entry in dev reloads the module.
- `scripts/changelog-entries.test.ts` checks the bundle order against the file names.
- Public changelog skipped: the page output is identical.
