# La patch del 3D non ricompila più gli shader

**Prima (#141):** a ogni patch lo script three.js (e quello di Composition) smaltiva la scena
vecchia *prima* di costruire la nuova. Smaltire l'ultimo materiale che usa un programma WebGL
lo cancella dalla cache del renderer, quindi la scena nuova, identica salvo un'uniform, ricompilava
tutto: ~0,5 s per cambiare un colore.

**Ora:** la scena vecchia viene smaltita solo dopo che la nuova è pronta e disegnata. Il renderer
è lo stesso, la chiave del programma non cambia, e three.js riusa i programmi in cache.

**Misura** (Chromium headless, SwiftShader, patch → hot-done + build pronta):

| modifica | prima | dopo |
|---|---|---|
| Text3D colore | 542 ms | 14 ms |
| Shape3D colore | 519 ms | 15 ms |
| Shape3D zoom | 539 ms | 14 ms |
| Shape3D luci | 847 ms | 15 ms |

0 pixel diversi rispetto al caricamento a freddo; 1 canvas dopo 10 patch.

**Scartato:** aggiornare in place materiali e uniform per prop. Più codice e una tabella prop →
uniform da mantenere, per un guadagno che il riuso dei programmi già dà.

**Non c'è un test unitario:** il fenomeno vive nella cache dei programmi di un WebGLRenderer
reale; la prova è la misura sopra, non un test.

**Bug del Title che sparisce dopo patch ravvicinate:** non riprodotto. Tentativi: harness con
`hyperframes-player` + `previewDriver`, la stessa `MotionPreview` in una pagina SvelteKit con il doc
segnalato (Shape ruotata + Title, frame 30, 10–60 patch a 0–40 ms), sia sul codice di #140 sia su
main, e un e2e `@real` sull'editor vero (10 modifiche di opacità e drag del Title con l'overlay).
Sempre visibile. Nessun fix senza riproduzione.
