# Motion in stile Apple minimal: tabella di stile, libreria di scene, l'agente regista

Prima: i video dell'agente motion erano "effetti PowerPoint". Le cause stavano nel prompt:
`DIRECTION_RULES` chiedeva una transizione vera (push, wipe, zoom, whip) a ogni taglio e il gate
segnalava `HardCuts` quando mancava; la "house style" voleva slide-up e una BrandBackground; il
recipe del trailer suggeriva particelle, light leak, morph e camera preset. Nessuna regola teneva
fuori particelle, glow, rotazioni, bounce.

Ora:

- `src/lib/motion/style.ts` è la sola tabella di stile (`STYLES`, una riga per stile): easing
  firmati (`cubic-bezier(0.22,1,0.36,1)` in entrata, `(0.65,0,0.35,1)` nei movimenti), durate
  (ingressi 0,6–1,2 s, scene 2–4 s), ampiezze (rise 3%, settle 97%, blur 12 px, push-in 4%, turn
  14°), tipografia (Inter, 600/400, hero 0,15 · line 0,075 · small 0,026), palette (nero, bianco,
  grigio, un accento), transizioni ammesse (taglio, crossfade, dip-to-black, blur) e gli effetti
  vietati (`Forbidden`), ognuno con il suo controllo in `CHECKS`. Le regole del prompt vivono
  nella stessa riga.
- Lo stile è un campo del doc (`style`, opzionale, default `apple-minimal` in `style-model.ts`,
  separato per non fare un ciclo con `doc.ts`). Tool `set_style` solo su richiesta esplicita;
  `get_motion_doc` lo mostra; la tabella di parità lo copre.
- `template/scenes.ts`: 18 scene `builtin:scene-*` costruite con i token della tabella. Gli
  helper di `builtins.ts` sono passati in `design-kit.ts` (commit di solo spostamento);
  `assemble` registra i font del template.
- Gate (`direction.ts`): `docProblems` aggiunge `OffStyle` per ogni effetto vietato (anche dentro
  i precomp, tempi locali); il layout di una scena da libreria è il suo template, non "Precomp@C"
  (altrimenti ogni scena sembrava ripetere la precedente). `HardCuts` è tolto: in Apple minimal il
  taglio sul beat è il default.
- Prompt: le regole dello stile al posto di `DIRECTION_RULES` e della house style; il recipe del
  trailer monta scene della libreria con un solo accento dal brand.

Verificato a occhio: ogni scena renderizzata con `composeHtml` + `__player.renderSeek` su
screenshot di dub.co. Corretti così la luce del product reveal (ellisse con bordo visibile → rect
radiale) e la scena "picture with a line" (il testo sopra uno screenshot affollato non si leggeva:
ora sta nella banda nera sotto la foto).

Limite trovato: un video tiene al massimo 50 campi (`MAX_FIELDS`); 18 scene insieme non entrano,
6–8 sì.

Scartato: un selettore di stile nell'inspector. Con un solo stile sarebbe un controllo senza
scelte; arriva con il secondo stile.

Prova (prompt Dub, Opus 5.5 reasoning low, chat dell'editor, dev server usa e getta):
- giro 1: 5 scene di libreria, $0,39, 75 s; stile giusto ma una sola immagine, piccola, ripetuta
  due volte. Aggiunta la regola "mostra il prodotto, grande, mai la stessa scena due volte" e il
  product reveal più grande;
- giro 2: 6 scene diverse (eyebrow-title, match-cut, product-reveal, ui-closeup sul funnel,
  device-split col QR, end card), 4 immagini reali, $0,36, 57 s, zero effetti vietati.
