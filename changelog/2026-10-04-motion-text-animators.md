# Motion editor: animatori di testo

Richiesta: animatori stile After Effects per carattere, parola o riga.

**Modello.** `clip.animators` (max 4, su Title/Text/Kicker/Caption): `unit`, selettore di range
(`start`/`end`/`offset` in %, `softness`, forma `square|ramp|smooth`, `seed` per un ordine
mescolato deterministico) e `values` (opacity, x, y in em, scale, rotation, blur, tracking,
color). Tutti gli animatori di un clip condividono l'unità: il testo si spezza una volta sola.
Ogni campo numerico è una `AnimProp` (`Source.Animator`, chiave `ta.<id>.<campo>`), quindi
keyframe, espressioni e inspector sono quelli di sempre.

**Render senza runtime.** Il testo si spezza al compose in `<span class="tu" style="--p:…">`
(posizione 0..1 nell'ordine, eventualmente mescolato). Lo stile di ogni unità è una funzione CSS
pura di `--p` e delle variabili dell'animatore (`clamp`/`calc`), che vivono sull'host del testo;
i keyframe muovono solo quelle variabili sulla timeline. Ogni frame è quindi funzione di
(frame, i): niente codice per carattere, seek in qualunque ordine. Nessuna dipendenza GSAP nuova
(niente SplitText).

**Preset.** `blur-up` (carattere, blur + salita), `word-stagger`, `line-mask-up`: un animatore e
due keyframe su `offset`.

**UI e agente.** Sezione «Text animators» nell'inspector (preset, forma, mescola, rimuovi,
parametri con ◆ e =). Tool `add_text_animator`, `set_text_animator`, `remove_text_animator`,
`apply_text_preset`; riga di parità.
