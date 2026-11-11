# macOS app launch checklist

The app is the hosted app (`https://oh.feega.app`) in Electron, web renderer only, ad-hoc signed
(no Apple Developer ID). Nothing below has been triggered. Do these in order.

**Release trigger:** `.github/workflows/app-release.yml` runs on every push to `main` (there is no
`app-v*` tag trigger). The version is the newest `app-v*` tag with its patch bumped; the app, the
npm `feega` package and the GitHub release share it. Step 3 is therefore what publishes the app.

1. **Merge PRs to `dev`** (done for the desktop work). Check: `gh pr list --base dev --state open`.
2. **Docs deploy**, so https://docs.feega.app/desktop/install-macos/ resolves (the app's Help menu
   and the release notes link to it). After: `curl -sI https://docs.feega.app/desktop/install-macos/ | head -1` is 200.
3. **Release `dev` to `main`**: `gh pr create --base main --head dev --title "Release: macOS app"`;
   merge when CI is green. This ships production (`oh.feega.app`) with everything the app needs
   (the login/`feega://auth/callback` route already exists on `main`) and starts the workflow:
   bundle, npm publish, `desktop` (arm64 on `macos-latest`, x64 on `macos-15-intel`),
   `desktop-release`. After: `gh run watch`, then `gh release view app-v<version>` lists
   `feega-<v>-mac-arm64.dmg`, `feega-<v>-mac-x64.dmg`, both `.zip`, `SHA256SUMS.txt`.
4. **Release notes**: `gh release edit app-v<version> --notes-file docs/desktop-launch-release-notes.md`.
5. **Landing deploy**, so the header/footer Download button picks the latest `app-v*` release.
   After: open https://feega.app, the button starts the dmg for your arch (falls back to the guide if none).
6. **Smoke test the downloaded dmg** on a Mac that did not build it: `shasum -a 256` against
   `SHA256SUMS.txt`; drag to Applications; follow the install guide (Open Anyway); sign in with
   email and with Google; open a `.feega` file; export an MP4 (save dialog); quit and reopen.
   Intel build: needs an Intel Mac or Rosetta check; it was not verified before launch.
7. **Announce** once 6 is green.
