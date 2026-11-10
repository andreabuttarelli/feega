# Landing: Download button for the macOS app

The "Star us" chip in the header is replaced by an Apple icon + "Download". The footer gets the same
button plus a link to the install guide (the app is unsigned, Gatekeeper blocks the first launch).

`/download/mac` (landing server route) lists GitHub releases, takes the newest non-draft `app-v*`
with a `-mac-<arch>.dmg` asset and answers 302 to its download URL, cached 5 min at the edge. Arch:
`?arch=`, else `Sec-CH-UA-Arch`, else arm64. No app release, GitHub down, or iOS/Android: 302 to
https://docs.feega.app/desktop/install-macos/. `/releases/latest` was rejected: `cli-v*` releases share the repo.
GitHub stays reachable from the header links and the footer icons.
