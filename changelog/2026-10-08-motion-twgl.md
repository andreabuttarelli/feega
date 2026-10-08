# TWGL.js nei componenti custom (e perché non regl)

Un componente custom ora riceve `twgl` (twgl.js 7.0.0, MIT) per shader WebGL2 scritti a mano:
programmi, buffer, uniform, draw. Come `gen` è inlineato: esbuild lo minifica in un IIFE
(`twgl-entry.ts`, `virtual:motion-twgl`, 81 KB; test: < 120 KB) — il pacchetto 7.x non porta un
`.min.js` e il sorgente intero su CDN pesa 439 KB. Offline ovunque, nessuna voce nella CSP.

- `twgl.webgl(canvas)` dà un contesto `webgl2` con `preserveDrawingBuffer: true`, così il frame
  resta leggibile alla cattura. TWGL non ha loop propri: si disegna in un `onUpdate` di `tl` con
  il tempo come uniform.
- **regl scartato**: compila i comandi generando codice con `Function` (in `regl.min.js`:
  `Function.apply(null, …)`), quindi esige `unsafe-eval` nella CSP della pagina — la stessa
  pagina che esegue il codice scritto dagli agenti. TWGL non genera codice.
- Licenza: la nota MIT viaggia come stringa in `twgl.notices`.
- Verificato: shader a bande radiali, doc costruito con `write_component`, 7 frame con
  `drawFrames` (Chromium locale, SwiftShader), le visite ripetute identiche al byte.
