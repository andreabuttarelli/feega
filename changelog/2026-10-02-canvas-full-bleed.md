# La tela perdeva il filo dopo il changelog

**Sintomo.** La tela si stringeva con 16px di margine ai lati; un reload la rimetteva a filo.

**Causa.** `/changelog` importa `src/lib/styles/landing.css`, globale: `.wrap { max-width: 1440px;
margin: 0 auto; padding: 0 16px }`. La voce "Changelog" del menu della tela (8e8fb5c7) ci
portava con navigazione client; al ritorno (Indietro) il foglio di stile restava nel documento e
colpiva `.wrap` di `CanvasFlow.svelte`. Stessi nomi in collisione anche per `.btn`, `.brand`,
`.logo`, `.thumb`, `.steps`.

**Fix.** La voce di menu che porta a una pagina marketing apre un documento nuovo
(`data-sveltekit-reload`, campo `marketingPage` nel registro del menu): `landing.css` non entra
mai nel documento dell'app, e Indietro torna a un documento pulito.

**Scartato.** Rinominare `.wrap` in `CanvasFlow` (cura un sintomo, le altre collisioni restano);
scoprire tutto `landing.css` sotto `html:not([data-shell='app'])` (1.400 righe con `@keyframes`,
`@property`, regole su `html`/`:root`: rischio alto per lo stesso effetto).

**Test.** `tests/e2e/canvas-full-bleed.spec.ts` (@real), desktop e mobile.
