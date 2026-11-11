# macOS app launch checklist

The app is the hosted app (`https://oh.feega.app`) in Electron, web renderer only (WebGPU, WebGL
fallback), ad-hoc signed. Nothing below has been triggered by the PR.

**Release trigger:** `.github/workflows/app-release.yml` runs on every push to `main`; there is no
`app-v*` tag trigger. The version is the newest `app-v*` tag with its patch bumped, shared by the
GitHub release, the npm `feega` package and the app. Any merge to `main` publishes.

**State before this PR:** `app-v0.1.27` is already public (dmg + zip for arm64 and x64,
`SHA256SUMS.txt`). It predates the hosted-by-default change: it opens local mode and packages the
native canvas addon. The next `main` merge auto-publishes `app-v0.1.28` from whatever is on `dev`,
so #1935 must be on `dev` first.

## Decision for you: app-v0.1.27

Run none of these until you choose.

- Leave it: the update check offers 0.1.28 to anyone who has it. No command.
- Mark pre-release (the landing button and the update check both ignore pre-releases):
  `gh release edit app-v0.1.27 --prerelease --repo andreabuttarelli/feega`
- Delete the release, keep the tag: `gh release delete app-v0.1.27 --repo andreabuttarelli/feega`
  (add `--cleanup-tag` to drop the tag; the next version is computed from the newest tag, so the
  next release would be 0.1.27 again only if the tag is removed).

## Order

1. **#1935 on `dev`**, CI green. Check: `gh pr view 1935 --json state`.
2. **Release `dev` to `main`** (#1981 or a new PR; this publishes the next `app-v`):
   `gh pr merge <n> --merge`. Check: `gh run watch`, then `gh release view app-v<next>` lists both
   dmgs, both zips and `SHA256SUMS.txt`; production `https://oh.feega.app` has the deploy.
3. **Smoke test the downloaded dmg** on a Mac that did not build it: `shasum -a 256` against
   `SHA256SUMS.txt`; install following the guide; reach the sign-in screen; sign in by email and
   Google; open a `.feega` file; export an MP4; quit and reopen. Intel: needs an Intel Mac.
4. **Deploy docs**, so https://docs.feega.app/desktop/install-macos/ resolves:
   `curl -sI https://docs.feega.app/desktop/install-macos/ | head -1` is 200.
5. **Deploy the landing**, so the Download button picks the latest `app-v*` release with a dmg.
   Check https://feega.app: the button starts the dmg for your arch.
6. **Release notes**: `gh release edit app-v<next> --notes-file docs/desktop-launch-release-notes.md`.
7. **Announce.**
