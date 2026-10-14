# Un frame modificato sulla tela tiene stage e selezione

Dopo #499 una modifica a una parte di un poster in un frame aperto sulla tela riportava la stage
all'immagine vecchia e toglieva selezione e box delle parti finché non si riselezionava; una
modifica di testo subito dopo falliva.

- `MotionNode`: `inlineStage.offer` dipendeva da `node.id` letto dalla prop, quindi ogni nuovo
  oggetto `node` (arriva a ogni revisione) rifaceva l'offerta e riazzerava il paint a `Pending`.
  Ora dipende da un `$derived` dell'id: l'offerta si rifà solo se cambia nodo o host.
- `SelectionOverlay`: mentre la preview ricarica `measure()` risponde vuoto per qualche secondo;
  i box venivano sostituiti con `{}`. `remeasured` tiene gli ultimi box finché arriva una misura vera.

Il comportamento di #499 (nessun nero all'apertura) resta: lo scambio parte ancora da `ready`.
Test: `remeasured` in `scene-select.test.ts`, e2e `canvas-poster-parts.spec.ts`.
