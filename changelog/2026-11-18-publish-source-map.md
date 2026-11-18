# feega-source-map on npm

`feega init` added `@feega/source-map` to the user's devDependencies, but the package was
private and only existed in this repo: `npm install` failed on every real project.

- Renamed to `feega-source-map`. The `@feega` npm scope does not exist and creating the org is
  an account action; the unscoped name matches `feega-cli` and the `feega` package, and the
  repo's `NPM_TOKEN` can publish it today.
- Exports pointed at `.ts` sources, which Node does not load from `node_modules`. The package
  now builds to `dist/` with `tsc` (`rewriteRelativeImportExtensions`); the Next loader path
  follows the running file's extension so it works from `src/` and `dist/`.
- `.github/workflows/source-map-release.yml` publishes on a `source-map-v*` tag, on a push to
  `main` that touches the package, or by hand, and skips a version already on npm.

Checked by packing the tarball and installing it into a fresh traidue clone: elements tagged,
bridge loaded through the Vite client.
