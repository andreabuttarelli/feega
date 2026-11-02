# URL import: light mode for scripts and servers too

`2026-11-01-import-light-scheme` pinned `prefers-color-scheme: light` by media emulation, yet
vercel.com still came back dark in some imports. Over Browserless, five reads of vercel.com on
dev gave dark twice: the stealth route's fingerprint answers the page's scripts, and vercel picks
its theme from `matchMedia` in an inline script, which the media emulation alone did not hold.

`fenced()` now also registers `lightOnly` before any page script (a `matchMedia` that answers
light to colour scheme queries, and `:root{color-scheme:light}`), and sends the
`Sec-CH-Prefers-Color-Scheme: light` client hint for themes chosen on the server. Five reads
over Browserless after the change: five light. A browser test reproduces a dark-answering
fingerprint.

Discarded: reading the theme twice and picking the lighter one: doubles the session cost and
still cannot say which theme a site considers its default.
