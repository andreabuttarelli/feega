# L'export nel browser su Safari perdeva goccia, lente e immagini

Segnalazione: un titolo con una goccia di vetro liquido (`LiquidBlob`) sopra. L'export web
interattivo era giusto; l'mp4 salvato dall'editor mostrava solo il testo, senza goccia.

Il doc non c'entrava: `composeHtml` baked, renderizzato in locale col producer, ha goccia e moto.
Anche il percorso dell'export (player, lane, bitmap, hot patch) in Chromium è giusto. Il difetto
è in WebKit: `captureRuntime` passava la frame a html-to-image, che la clona in un SVG con
`foreignObject`; ogni `<canvas>` (WebGL della goccia, lente, three, particelle) e ogni immagine
diventa un `<img data:...>` annidato. WebKit carica le immagini annidate in un'immagine SVG solo
dopo averla disegnata, e solo a piena risoluzione: il primo disegno — l'unico che facevamo — esce
senza. Ogni frame dell'export ha un canvas nuovo, quindi mancavano tutte.

Cosa cambia:

- `capture.ts` usa `toSvg` e disegna da sé (`paintSvg` in `svg-paint.ts`).
- Una sonda una tantum (un SVG con un pixel annidato) dice se il motore carica pigro. Solo lì, e
  solo se la frame ha immagini annidate, si ridisegna a piena risoluzione un frame alla volta
  finché l'impronta 64×36 cambia e poi resta ferma per 3 frame (massimo 12). Chromium non aspetta.
- Scartati: un secondo load subito dopo (WebKit non ha ancora le immagini), un'attesa fissa
  (racy), stampe a 64×36 senza disegno pieno (non innescano il caricamento), comporre i canvas a
  mano sopra la frame (sbaglia l'ordine di ciò che sta sopra).

Input senza cursore: in un video `input.pointer.x/y` valevano 0.5 fissi, quindi una goccia che
segue il cursore restava ferma al centro. Ora il fallback è un vagare lento attorno al centro
(0.5 ± 0.22 su 7 s in x, ± 0.14 su 4.6 s in y, parte da 0.5). Vale per anteprima, render e
player live finché il cursore non arriva, quindi anteprima e video restano uguali.

Resta aperto: l'mp4 dell'export nel browser schiarisce i neri (#0a0a0a esce #191919): range
colore dell'encoder, non toccato qui.
