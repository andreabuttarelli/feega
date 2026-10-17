# Video come riferimento

Prima la chat accettava solo immagini e documenti: un video di riferimento non entrava, e "fammi
un video come questo" restava a parole.

Ora un video (MP4, MOV, WebM, fino a 20 MB) è un `AttachmentKind.Video` sulla stessa strada degli
allegati: upload, URL, libreria (`asset_id`). Passa da `screenModelReferences` con
`ReferenceMedium.Video` come le immagini: in un progetto uncensored un video con persone non
diventa riferimento.

`src/lib/server/video-reference.ts` lo fa guardare a `llmVideoReviewerModel()` (Gemini via
OpenRouter, `video_url`) con un prompt fisso, valida la risposta (`src/lib/video-reference.ts`) e
la salva in `canvas-assets/<org>/<project|library>/analysis/<asset>.video.v1.json`: si paga una
volta. Il costo va in `ai_calls` con label `video.reference`.

Dove arriva:
- primo messaggio di chat (sidebar ed editor motion): il breakdown è inline accanto all'allegato;
- tool motion `read_video_reference`;
- canvas op `read_video_reference` (Spend): chat sidebar (`canvas_tool`), API e MCP.

Scartato: colonna nuova su `assets` (niente migration con il DB instabile; la cache per file segue
`audio-analysis`). Sul canvas un video collegato a un nodo testo o video arriva già nativo al
modello: nessun cambio lì. I nodi immagine non accettano video: fuori.
