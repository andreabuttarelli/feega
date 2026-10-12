# Template "circular carousel"

Componente custom **live** (`circular-carousel/`): media su un anello CSS 3D, l'elemento davanti
pieno e nitido, gli altri arretrano e si scuriscono.

- **Schermo (preview, embed)**: bottoni tondi ‹ › in basso al centro, drag con rilascio che
  scatta all'elemento più vicino (mai indietro contro il moto), tap su un elemento laterale,
  frecce ← →, autoplay che si ferma per 4 s dopo ogni interazione. Curve: expo in-out per un
  passo da fermo, expo out quando il moto è già in corso (nessun overshoot).
- **Video**: il corpo restituisce `still(t)`, che disegna `sequencePos(t)` — un passo ogni
  `interval` secondi, funzione pura di t. L'autoplay governa solo lo schermo: il video avanza
  sempre.
- **Avviso noto**: l'export video mostra ancora "will look different" (`liveNote`), perché
  `liveComponents` segnala ogni componente live. Qui è falso: il video è la sequenza
  automatica. Toglierlo richiede che un componente dichiari di avere uno still fedele —
  rinviato, da decidere.
- Ancora assente: anteprima in `previews.json`.
