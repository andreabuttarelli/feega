# VS Code extension published

The extension in `vscode/` was never listed. It is now published as `AndreaButtarelli.feega`
(publisher id chosen by the user) on the VS Code Marketplace and Open VSX by
`.github/workflows/vscode-release.yml` on `vscode-v*` tags (secrets `VSCE_PAT`, `OVSX_PAT`).

- `npm test` in `vscode/` ran the e2e suite too (it needs a VS Code host); it now runs the unit
  tests only, and the release runs them before publishing.
- Open VSX refuses a publish into a missing namespace: the release creates it once.
- Store images come from the README; relative paths are rewritten to the tag on GitHub raw
  (`--baseImagesUrl`), so a screenshot goes live with the version that ships it.
