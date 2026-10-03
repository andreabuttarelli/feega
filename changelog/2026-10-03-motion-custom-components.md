# Motion M2: componenti scritti in codice

Prima: l'agente motion poteva usare solo la libreria (Title, Image, CanvasMock…). Le scene UI
del promo (nodi, archi, porte, chat che scrive, calendario, cursori) non erano esprimibili.

**Doc.** `MotionDoc.components: { [Name]: { source: { html, css, js }, propsSchema, version,
check } }` (default `{}`, nessuna migrazione). Una clip `component: 'Custom'` con
`props: { name, ...valori }`: i valori sono validati contro `propsSchema` in scrittura
(`Strictness.Strict`) e normalizzati ai default in lettura (`Lenient`), così riscrivere lo
schema non rende illeggibile un doc salvato. Timeline, keyframe, maschere e transizioni restano
i wrapper esterni, invariati.

**Contratto d'autore** (`custom/lint.ts`, acorn; testo nel prompt da `FORBIDDEN_NAMES`): il JS è
il corpo di una funzione `({ root, props, tl, duration, fps, assets, brand, rand, gsap,
SplitText, lottie, THREE })`; ogni animazione va su `tl`, figlia della timeline master in pausa,
posta all'inizio della clip. Vietati timer, rAF, rete, `import()`, eval/Function, globali del
parent, storage, orologio, `Math.random` (c'è `rand`, seed per clip), CSS animation/transition/
@keyframes/url esterni, `<script>/<style>/<iframe>/<video>`/on*. A runtime gli stessi nomi sono
parametri `undefined` della funzione, `Math`/`Date` sono proxy che lanciano.

**Sandbox.** L'anteprima e l'export girano nell'iframe di `@hyperframes/player` con
`sandbox="allow-scripts"` senza `allow-same-origin` (`sandbox-origin="opaque"`): origine opaca,
nessun accesso a cookie, storage o DOM dell'app. In più una CSP `<meta>` per composizione
(`hyperframes/csp.ts`): `default-src 'none'`, script solo dagli URL esatti di runtime, GSAP,
html-to-image, SplitText/lottie/three quando servono; niente `unsafe-eval`; img/media/connect solo
dalle origini degli asset del doc (gli URL firmati di Supabase) e dai font Google. `connect-src`
non è vuoto: html-to-image deve scaricare immagini e font per catturare il frame. Scelta: niente
sottodominio dedicato (render.feega.app). L'origine opaca è già un'origine separata e non
richiede DNS né un secondo progetto Vercel; un sottodominio aggiungerebbe solo isolamento di
processo, al prezzo di infrastruttura. Se servirà: servire la composizione da
`render.feega.app/c/<id>` con le stesse header CSP e passare `src` al player.

**Gate di determinismo** (`custom/determinism.ts`, `run-check.ts`): il componente da solo, 5
punti, visitati avanti, indietro e in ordine sparso; stesso JPEG e stessa firma di layout
(rettangoli degli elementi, nel runtime di cattura) a ogni visita, nessun errore. Lo stato vive
in `check` con l'hash del sorgente: cambia il codice, torna `unchecked`. L'editor controlla da
solo i componenti `unchecked`; l'export (`ExportDialog`) aspetta finché un componente usato
non è `passed`.

**Agente.** `write_component`, `patch_component` (trova/sostituisci, una occorrenza),
`read_component`, `remove_component`; `list_components` = libreria + custom. Ogni scrittura
chiede al browser il check (`data-motion-check`, risposta via storage `verdict.json`) e un
fallimento torna come errore con i due frame diversi in immagine. Modello: i passi che toccano
codice vanno su `LLM_CODE_MODEL` (default `anthropic/claude-sonnet-5.5`, $2/$10 per M token, il
migliore per costo fra Sonnet 5.5, Opus 5.5 $4/$20 e GPT-5.6 sol $2/$10 sul nostro uso UI);
il resto resta sul modello di default. Instradamento in `model-route.ts`: intento del
messaggio o clip custom selezionata → codice dall'inizio; lettura di codice → codice per il
resto del turno; `write/patch` attivi solo sul tier codice. Tetto: 12 scritture e $1.50 per
turno, ogni passo in `ai_calls` con il suo modello (`motion-agent-code`).

**Editor.** Tab Code (CodeMirror 6 caricato al primo uso): JS/HTML/CSS/Props, modifica come
revisione (undo/redo), diff unificato contro la revisione precedente, pannello errori (lint,
check). Le props si editano da `propsSchema` (`customFields`).

Scartati: shadow DOM per lo scoping (html-to-image non lo cattura), `new Function` per isolare i
componenti (bloccato dalla CSP, giustamente), un secondo processo di render server-side.

**Variabili dichiarate nel codice** (`custom/params.ts`). Il JS dichiara le variabili con
`param('nome', default, { type, min, max, step, options, label, group })`; tipi text, textarea,
number, color, boolean, select, asset (kind image|video|model3d), font, ease. `extractParams`
(acorn) le legge a ogni scrittura e ricostruisce `propsSchema` (lo schema passato a mano resta
solo per chiavi senza `param`): l'agente non mantiene uno schema separato. L'inspector le mostra
per `group`; number e color sono keyframeabili (`Source.Param`, `withParams(doc, clip)` porta le
loro `AnimProp` dove serve validare o campionare). A runtime `param()` e `props.nome` restituiscono
il valore; per un parametro con keyframe `props.nome` è un getter che campiona la traccia al
tempo della clip (non un tween: in seek all'indietro GSAP rende i figli in ordine inverso e un
tween su `props` arriverebbe dopo il codice che lo legge). Il CSS legge `var(--param-nome)`,
interpolata da tween sul root. Cambiare un valore non richiede l'agente.

**onUpdate in seek.** Il runtime HyperFrames fa `totalTime(t, true)`: eventi soppressi, quindi
ogni `onUpdate` dei componenti non girava in anteprima né in export (testo che non si scrive,
barre ferme) e il check di determinismo passava su frame vuoti. Il `tl` dato al componente
sposta `onUpdate` in un plugin di render (`feegaRender`, `rawVars`), che GSAP esegue anche con
eventi soppressi. `tl.call`/`onComplete` restano non supportati (detto nel prompt).
