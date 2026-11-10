# Desktop app opens the hosted app by default

PR #1929 made the macOS app local-only. It is meant to be the desktop web app, so the hosted
app (`oh.feega.app`) is the default again: login, orgs, billing, AI. OAuth leaves for the system
browser (Google blocks embedded webviews) and returns through `feega://auth/callback`, which the
web app already targets for `FeegaNative` user agents.

Local mode stays: File → Open Local File…, opening or dropping a `.feega` file. The last local
file is no longer reopened at launch.

Added: Settings… (⌘,) to the current project's settings, Help menu, downloads through the save
dialog, offline page with retry, remembered window bounds.

Kept the bundled server (~340 MB dmg): local mode and code-folder import need it. Shipping it as
an on-demand download is the way to shrink the dmg; not done here.
