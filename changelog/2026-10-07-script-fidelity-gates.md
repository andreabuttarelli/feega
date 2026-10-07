# Il video deve rispettare lo script, e il ritmo blocca

Supasito v3 aveva ricerca e script buoni, ma il video non li seguiva: sidebar con sole barre
grigie, promessa tagliata, nessun logo nel claim, scene tagliate mentre ancora si muovevano. Il
gate non vedeva nessuno dei quattro.

- `script-drift` (bloccante, `script-drift.ts`): con `doc.script` salvato, ogni atto deve essere
  marcato con `mark_story`; nella sua finestra (dal suo marker al successivo) devono comparire le
  righe `on_screen` parola per parola, e nel claim anche la promessa intera e un clip `Logo`. Il
  testo visibile viene da Title/Text/Kicker/Caption e dai parametri Content dei pezzi del kit,
  anche dentro le scene (precomp). Confronto su testo normalizzato (minuscole, senza accenti e
  punteggiatura), parole in ordine anche sparse su più clip (il word burst): se ne compare solo
  una parte iniziale il gate dice "cut short". Scartato: confrontare i tempi dello script, che
  sono un piano; contano i marker.
- `empty-ui` più severo: `ui-kit/render.ts` (il finto DOM che stava nel test del kit) disegna il
  pezzo con le sue props a 2,5 s e alla fine della clip; tre o più righe sorelle senza testo, o
  una `card` di sole forme, bloccano. Lo skeleton di `UiGeneratedResult`, che si riempie entro
  2,5 s, passa. La sidebar disegnava le righe come barre grigie: ora ha il parametro `rows`.
- Ritmo, tre gate bloccanti nella tabella `SEVERITY`:
  - `cut-mid-animation` (riprende la #214): un clip, un clip dentro una scena o un pezzo del kit
    ancora in movimento al taglio; il taglio arriva prima se c'è una transizione d'uscita o una
    giunzione.
  - `no-hold`: meno di 1 s tra l'ultima animazione della scena e il taglio. Derive ≥ 2 s e uscite
    (l'ultimo movimento di una traccia, partito nell'ultimo secondo, che arriva al taglio) non
    contano.
  - `reading-time`: rinomina `unreadable-text`, pausa da 0,5 a 1 s.
- I tempi dei pezzi del kit si misurano disegnandoli (ultimo fotogramma che cambia, caret e
  sheen esclusi): la tabella `SETTLES` della #214 copriva 7 pezzi su 19 e andava tenuta a mano.
- Scene builtin allungate per passare (word burst, speed ramp, device fly, tilt zoom, orbit,
  number match cut, claim run, logo build; eyebrow, feature line, quote, split, UI window, match
  cut). Il tetto delle scene launch passa da 4 a 5 s: due claim tenuti per la lettura chiedono
  4,5 s.

Il caso doc-v3 non era disponibile: i test riproducono i suoi difetti su un doc costruito con lo
stesso script.
