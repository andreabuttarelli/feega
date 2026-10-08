# Splitting.js nei componenti custom

Un componente custom riceve `Splitting` (Splitting.js 1.1.0, MIT, Stephen Shaw): spezza testo in
caratteri, parole, righe (e layout in item, griglie, celle) e scrive su ogni pezzo
`--char-index`, `--word-index`, `--line-index` e i totali.

- **Seekable in due modi**: stagger su `tl` sui pezzi restituiti, oppure `Splitting.drive(el)`, che
  porta una sola variabile `--split` da 0 a 1 su `tl`; il CSS del componente la combina con gli
  indici. Nessuna animazione CSS: il lint resta com'era.
- **Scoped alla clip**: un `target` stringa (default `[data-splitting]`) cerca solo dentro `root`,
  mai in altre clip della pagina.
- Il CSS raccomandato della libreria non è vendorizzato (porta `transition: inherit`): una riga
  nostra rende `inline-block` parole e caratteri e registra `--split` con `@property`.
- Inlineato come `fx` (`splitting-entry.ts`, `virtual:motion-splitting`, 4,9 KB; test < 8 KB) solo
  dove serve; la nota MIT viaggia in `notices`.
- `motion.split` del motore resta: divide senza variabili d'indice.
- Verificato: demo con `write_component`, 7 frame da Chromium locale, visite ripetute identiche al
  byte (`~/Documents/feega-videos/css-libs/splitting/`).
