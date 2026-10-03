# Motion editor (MVP)

**Perché.** Un nodo `motion` sulla tela apre un editor a schermo intero: anteprima, timeline,
proprietà e una chat che modifica lo stesso video. Solo componenti di libreria: l'agente non
scrive codice.

**Modello.** La verità è un `MotionDoc` JSON (zod, `src/lib/motion/doc.ts`): tracce, clip con
`from/durationInFrames/trimStart`, componente, props, transizioni. Ogni componente ha uno schema
zod (`components.ts`) che valida le props e genera l'inspector (`inspector.ts`). Le operazioni
della timeline (move, trim, split, snap, duplicate, reorder, undo) sono funzioni pure
(`timeline.ts`, `history.ts`). Il doc vive in `motion_revisions` (append-only, RLS org, unique
`(node_id, version)` = concorrenza ottimistica); `nodes.data` tiene solo `format` e
`docHeadRevision`. Un turno dell'agente = una revisione; undo condiviso con le modifiche umane.

**Motore: HyperFrames 0.8.114, non Remotion.** Prima versione su Remotion 4.0.532, poi sostituita:
`composeHtml(doc)` (`hyperframes/compose.ts`) genera una composizione HTML (data-start/duration,
una timeline GSAP in pausa, three.js per i clip 3D con import solo se servono). Pro: niente React
nel bundle, anteprima in iframe sandbox opaco (`<hyperframes-player srcdoc>`), seek esatto al
frame, stesso HTML per il render. Remotion scartato: React dentro Svelte, licenza aziendale sopra
3 dipendenti, e due kit da tenere allineati.

**Render.** Porta `MotionRenderer` (`server/motion/renderer.ts`), adattatore Lambda di
HyperFrames. Senza configurazione fallisce chiuso: il bottone dice «Rendering not configured».
Variabili: `HYPERFRAMES_LAMBDA_REGION` (eu-central-1), `HYPERFRAMES_LAMBDA_BUCKET`,
`HYPERFRAMES_LAMBDA_STATE_MACHINE_ARN`, `HYPERFRAMES_AWS_ACCESS_KEY_ID`,
`HYPERFRAMES_AWS_SECRET_ACCESS_KEY`; più `npm i @hyperframes/aws-lambda@0.8.114` e il deploy del
suo stack (`npx hyperframes lambda deploy`). Prezzo mostrato prima: `ceil(s/10) × (720p 1, 1080p 2)`.

**Mancante (M2).** Polling del render → `node_runs` → copia in storage + content credentials +
addebito crediti; poster del nodo; keyframe; sandbox su origine separata per codice scritto
dall'agente; anteprima che non ricarica l'iframe a ogni modifica.

**Migration.** `supabase/canvas-migrations/20261003_motion_node.sql`: `nodes_type_check` +
`motion`, tabella `motion_revisions`, `chat_threads.node_id` e surface `motion`.
