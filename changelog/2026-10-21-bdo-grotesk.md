# App font: BDO Grotesk

Interface sans switched from DM Sans to BDO Grotesk (Lokal Container, SIL OFL 1.1).
Four weights self-hosted in `static/fonts/` from the official repo
`LCTipografi/BDO-Grotesk` (`Fonts/Webfont`, woff2): 400, 500, 600, 700. License text
in `static/fonts/BDO-Grotesk-OFL.txt`.

Changed: `--sans` in `src/app.css` now starts with "BDO Grotesk" (fallback stack
unchanged minus DM Sans); `DESIGN.md` UI text row; `src/app.html` preload points to
the Regular file.

Unchanged: `--serif` (heading token, still DM Sans), monospace, motion/video/template
fonts, brand typography lists.

Discarded: npm `@fontsource*/bdo-grotesk` (not published), Google Fonts (not hosted).
Family author is Lokal Container, not VJ Type.
