# UI ricreata dal vivo, testi leggibili

Il golden v2 dub.co è stato bocciato per due motivi: parole a schermo pochissimo e screenshot usati
di continuo come contenuto. I film di lancio SaaS ricostruiscono la UI in vettoriale e la animano.

- **Kit `src/lib/motion/ui-kit/kit.ts`**: sette componenti Custom parametrici (link shortener con
  digitazione, cursore e toast; lista link che si popola; stat card con numeri che contano e
  grafico a linee o barre; funnel; tabella payouts con stato Pending→Paid; QR che si costruisce;
  chrome browser/telefono). Ognuno prende font, colori e raggio del brand, `zoom` e `speed`, e si
  anima da solo, seek-safe (`render(t)` su `tl`). Il tool `add_ui` scrive il componente nel doc la
  prima volta (fuori dal budget di code write: il codice è nostro) e aggiunge il clip; rifiuta
  prop sconosciute.
- **Gate**: `unreadable-text` (testo a schermo meno di 0,4 s a parola + 0,6 s, minimo 1,2 s per
  una frase; in entrambi gli stili) e `screenshots` (nel launch film: screenshot non sfocati che
  coprono ≥ 25 % del frame per più del 30 % di un film di almeno 6 s).
- **Scene launch** adeguate alla lettura: word burst che costruisce la frase e la tiene, numeri e
  claim tenuti due beat, montaggio senza screenshot sfocati (ora "claim run"), titoli e chiusura
  più lunghi. `scene-split-statement` con un paragrafo più corto.
- **Prompt e stile**: per un SaaS la UI si ricrea con `add_ui`, mai screenshot; la tipografia
  cinetica resta leggibile, l'energia viene da movimento e transizioni.
- Il parametro font di un Custom arriva già come stack CSS (`'Inter', system-ui, sans-serif`):
  rimetterlo tra virgolette lo rompe e il testo esce serif.

Scartato: componenti Svelte o un renderer UI separato. I Custom esistono già, passano dal check di
determinismo e dall'export: un kit di sorgenti è il pezzo più piccolo che serve.

## Dopo il golden v3 ("meglio"): inquadratura e storia

- **`out-of-frame`** (`direction.ts`, ogni stile): stima il riquadro reale di testi (glifi, non il
  box) e pezzi del kit (dimensione di progetto × fit × zoom) frame per frame, con scala e offset
  dei keyframe; nominato se esce dalla safe area (5 % per lato) per più di 6 frame fuori dai primi
  e ultimi 0,35 s del clip (uscite di transizione ammesse). È una misura geometrica sul doc, non
  sui pixel resi: i pixel non dicono quale elemento è importante.
- **Kit**: ogni pezzo dichiara la sua `size`; il componente si adatta da solo al 90 % del frame
  (`uiScale`, stessa formula nel JS) a qualunque formato. `zoom` resta un moltiplicatore.
- **Storia in 4 atti**: `story.ts` (problem/solution/proof/claim, quote 20/15/45/20 %), tool
  `mark_story` (marker `story: <atto>`), gate `missing-story-beat` nel launch film per film di
  almeno 6 s. Prompt: atti obbligatori, copy del problema con le parole del sito, regola di
  inquadratura (scala entro ~10 %, muovere posizione e camera). Lo storyboard Deep non è su main:
  dovrà usare `mark_story` quando arriva.
