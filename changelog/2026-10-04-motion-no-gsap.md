# Motion editor: via GSAP, motore di animazione nostro

**Perché.** La licenza Standard "No Charge" di GSAP vieta l'uso in costruttori visuali no-code di
animazioni che competono con Webflow: l'editor motion è esattamente quello. Decisione: togliere
GSAP del tutto, non solo dal bundle (motivo anche in `docs/legal-review-checklist.md`).

**Prima.** Il generatore (`hyperframes/animate.ts`, `compose.ts`) scriveva `gsap.timeline`,
`gsap.set`, `gsap.registerEase`; la pagina caricava `gsap.min.js` (e `SplitText.min.js` quando un
componente lo nominava) dal CDN; i componenti codice ricevevano `gsap`, `SplitText` e un `tl` GSAP
con un plugin `feegaRender` per far girare `onUpdate` sotto il seek a callback soppresse; camera e
three.js si agganciavano con un plugin di render (`seekDriver`).

**Ora.** `src/lib/motion/engine/engine.ts`: una funzione autosufficiente (`motionEngine`) che la
pagina riceve inline (`engineScript()`, `window.__feegaMotion`) e i test usano direttamente.
- Timeline con la stessa superficie che il generatore, i componenti e il runtime HyperFrames usano:
  `to/from/fromTo/set`, posizioni (`+=`, `<`, `>`, label), `stagger`, `repeat/yoyo`, timeline
  annidate, `tweenFromTo` (trim), `totalTime/seek/time/progress`, `play/pause/timeScale` per la
  preview, `getChildren` con `startTime/duration/totalDuration/vars` per il dedup dei frame statici
  del producer.
- Stato senza storia: il valore di ogni proprietà a un tempo t dipende solo da t (il segmento
  attivo con l'inizio più recente, altrimenti l'ultimo concluso, altrimenti il valore iniziale o
  il `from` dell'ultimo `immediateRender`). `onUpdate` gira a ogni render; `call()`, `onStart`,
  `onComplete` non girano mai: la lezione "callback soppresse sul seek" non può ripresentarsi.
- Ease: tutto il vocabolario GSAP (power0–4, quad…strong, sine, expo, circ, back, elastic,
  bounce, steps, nomi vecchi `Power2.easeOut`), confrontato numericamente con le curve GSAP nei
  test; le bezier dei keyframe restano registrate con `registerEase` sul campionatore di
  `keyframes.ts`.
- Scrittura: trasformazioni composte per elemento nell'ordine e nel formato GSAP (3D mentre si
  muove, 2D a riposo, `translate/rotate/scale: none`), numeri arrotondati a 1e-4, px di default
  tranne le proprietà senza unità, stringhe con numeri e colori interpolate pezzo per pezzo con la
  stringa finale esatta a fine tween, `attr`, variabili CSS, oggetti semplici. Lo scopo è la
  parità al pixel con i render già fatti, non un'API più bella.
- Componenti codice: `tl` è la timeline del motore; nuovo `motion` (`parseEase`, `split`,
  `utils.interpolate`); `gsap` e `SplitText` restano come alias del motore per i componenti già
  salvati (non documentati nel prompt). Non ho aggiunto nomi corti (`ease`, `split`) al
  destructuring: un `const ease` in un componente salvato diventerebbe un SyntaxError.
- `split` lavora sul DOM (le righe si ricavano da `offsetTop`); quello dei text animator lavora su
  stringhe con `--p` per unità, quindi non era riusabile così com'è.

**Tolto.** `gsap` da `package.json`, gli URL CDN di GSAP e SplitText (CSP inclusa: escono dalla
lista degli script), `Library.SplitText`, il plugin `feegaRender`, il proxy `authored`.

**Parità (render server, producer HyperFrames 0.8.114, prima/dopo sullo stesso HTML di asset).**
Trailer codice, transitions v2, demo camera (anche con motion blur e un clip tenuto fermo), i 7
template ad (trailer v2 compreso) e le 9 composizioni: nessun frame sotto 40 dB (minimo 41,9), le
composizioni e l'UGC identiche al bit, tempo di render totale 417 s → 391 s (rumore di ±10 s per
doc, nessuna tendenza), seek della timeline in pagina sotto 0,3 ms. Il motion blur ha chiesto una
cosa in più: `holdStill` riscrive l'ease dei tween e chiama `invalidate()`, quindi le tween del
motore rileggono `vars.ease` e `getChildren` scende nelle timeline annidate con `parent`. I due
punti più bassi sono errori del vecchio render, non del nuovo: in transitions v2 il contatore
"Scheduled" di un CalendarScene tagliato (trim) restava a 0 per tutto il clip con GSAP, ora
conta 11 come i post visibili; nel trailer due frame del CollabScene mostravano gli archi in uno
stato che non corrisponde al loro tempo, ora seguono la timeline scritta.
