# matter.js nei componenti custom

Un componente custom ora riceve `Matter` (matter-js 0.20.0, MIT, `matter.min.js` 83 KB) per la
fisica 2D. Tag pinnato su jsDelivr, nella CSP, solo se un componente usato nomina `Matter`.

**Il determinismo sta in `Matter.seekable(engine)`.** Restituisce `at(t)`: il mondo avanza a
passo fisso (`1000 / fps` ms) da t=0 fino al frame chiesto e registra le pose `{ x, y, angle }`
di ogni corpo per ogni frame. Un seek indietro legge la pose registrata; uno avanti continua a
passare dal frame più alto raggiunto. Il motore non torna mai indietro, quindi ogni frame è lo
stesso in qualunque ordine si arrivi. Il passo si ferma alla fine del clip (tetto: la sua
durata). `Common._seed` prende il seed del clip, così `Common.random` non cambia tra preview e
render.

- `ctx.Matter` eredita dalla libreria con `Runner` e `Render` a `undefined`; il lint rifiuta
  `Matter.Runner` e `Matter.Render`. Il disegno lo fa il componente (DOM, SVG o canvas).
- Scartato: snapshot completi del motore per riavvolgerlo — matter non ha un clone affidabile
  dello stato (vincoli, cache di collisione), e le pose bastano per disegnare.
- Costo: memoria = frame × corpi; 60 s a 30 fps con 500 corpi ≈ 900k pose. Il primo seek lontano
  paga la simulazione fino a lì, i successivi no.
- Verificato: 36 corpi che cadono e si impilano, doc costruito con `write_component`, 7 frame
  con `drawFrames` (Chromium locale), le visite ripetute identiche al byte; test jsdom con la
  libreria vera.
