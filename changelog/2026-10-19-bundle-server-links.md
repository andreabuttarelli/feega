# Server pages opened from app pages, in the native bundle

After media (#907), the remaining links and frames an app page opens on a server route:

- **Granted routes**: the asset grant now covers a short list of `GET` routes an element or a link
  opens (`GRANTABLE` in `$lib/canvas/asset-url.ts`): canvas assets, a frame's `preview` and
  `live` iframes, chat web-view shots, the studio zip, the account export. `grantedPath` gives
  them the API host and the grant in the bundle and leaves them as they are on the web; the
  builders (`motionPreviewPath`, `motionLivePath`, chat web views, studio zip hrefs, profile
  export) go through it. The hook opens a grant on those paths only.
- **Public web pages** (`/changelog`, `/report`, `/gallery`, legal, docs) linked from app pages
  open on the web host in a new window in the bundle (`$lib/api/bundle-links.ts`), which the
  shells hand to the system browser.
- Sign-out is in #909.
