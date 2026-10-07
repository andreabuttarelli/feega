# Device3D: aspect reale dello schermo e `screenFit`

Lo schermo di un telefono è 1206×2622 (9:19.6): una sorgente 9:16 messa in cover perdeva circa
il 9–11% per lato, e né l'agente né l'inspector potevano saperlo o evitarlo.

- `SCREEN` in `devices.ts`: per ogni device px, aspect leggibile e `safeTop` (la fascia coperta
  da isola, notch o foro), derivati dalla tabella `DEVICE`, non scritti a mano.
- Prop `screenFit` (`cover` | `contain` | `safe`). `cover` resta il default e il comportamento di
  prima (uno screenshot più alto scorre); `contain` mostra tutta la sorgente con bande; `safe` la
  mostra tutta sotto il cutout.
- La geometria sta in `screenPlacement` (`three-draw.ts`), pura e testata, serializzata nel
  runtime come `screenKey`: preview, browser e render usano la stessa funzione.
- La descrizione di Device3D elenca px e aspect di ogni schermo, così l'agente sceglie la
  sorgente o il fit giusti prima di renderizzare.
