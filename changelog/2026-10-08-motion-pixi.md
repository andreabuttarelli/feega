# PixiJS nei componenti custom

Un componente custom ora riceve `PIXI` (pixi.js 7.4.3, MIT, `pixi.min.js` 456 KB +
`@pixi/unsafe-eval` 3 KB) per sprite e particelle 2D in WebGL. Due tag pinnati su jsDelivr,
nella CSP, solo se un componente usato nomina `PIXI`.

- **`ctx.PIXI.Application` forza `autoStart: false`, `sharedTicker: false`,
  `preserveDrawingBuffer: true`** (un oggetto che eredita dal namespace, il resto di PIXI è
  intatto). Nessun ticker: il componente posiziona gli sprite in un `onUpdate` di `tl` e chiama
  `app.render()`. Il lint rifiuta `ticker` e `Ticker`.
- `@pixi/unsafe-eval`: la nostra CSP non ha `unsafe-eval`, e senza questo modulo Pixi 7 si
  rifiuta di sincronizzare gli uniform. Meglio del modulo che allargare la CSP.
- Pixi 8 scartato: `Application.init()` è asincrono, il boot dei componenti è sincrono e il
  primo seek arriverebbe prima del renderer.
- Scartato il render automatico a ogni seek: l'engine chiama gli `onUpdate` in ordine di inizio,
  e un render messo dal runtime girerebbe prima dei tween del componente che partono dopo.
- Verificato: 600 sprite, doc costruito con `write_component`, 7 frame con `drawFrames`
  (Chromium locale, SwiftShader), le visite ripetute identiche al byte.
