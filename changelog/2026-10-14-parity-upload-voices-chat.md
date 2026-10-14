# Parity: upload, voci, render server, chat di progetto

Chiude 8 dei 13 gap congelati da #533 (`src/lib/server/parity/ui-actions.ts`). I 5 di post e
calendario (`create_post`, `calendar_posts`, `plan_post`, `schedule_post`, Promote) li toglie la PR
che rimuove quella superficie.

- **Upload**: due op in `CANVAS_OPS`. `request_upload` rifà il controllo della tela
  (`verdictForUpload`: formato, 4MB immagine/documento, 200MB video) PRIMA di firmare, e firma un
  upload in `canvas-assets` sotto `${orgId}/${projectId}/` (stesso schema `uuid-nome` della UI, nome
  ripulito da `/` e `..`). `register_upload` chiama `registerCanvasUpload`, la funzione della UI.
  Scartato il multipart: il corpo su Vercel si ferma a ~4.5MB, il video no.
  CLI `feega canvas upload <project> <file>`: chiede, fa PUT, registra.
- **Voci**: `list_voices`, `voice_library`, `use_library_voice`, `design_voice`, `save_voice`,
  `clone_voice`, `delete_voice`, sugli use case di `custom-voices.ts`. Design e clone sono
  `Access.Spend` (stesso cancello crediti). Il campione del clone viaggia in base64, max 3MB (sta
  nel corpo); il modo uncensored del progetto si legge dal progetto.
- **Render server**: nessun cambio di codice. `render_video mode:"server"` passa già da
  `startFarmRender`, lo stesso percorso e cancello del bottone Render; il farm è chiuso per tutti
  (`serverRenderOpen() === false`) e la UI rifiuta allo stesso modo. Il gap diventa una riga
  mappata; la descrizione MCP dice il 403 `server_render_unavailable`.
- **Chat di progetto**: i 16 tool scritti a mano (`inputSchema`/`execute` ripetuti) diventano una
  tabella di descrizioni `CHAT_TOOL_OPS`; ogni altra op arriva da un tool `canvas_tool { op, input }`
  generato dalla tabella, con i campi letti dagli schemi zod. Le op che vogliono byte che la chat
  non sa mandare (`request_upload`, `register_upload`, `clone_voice`) sono `Audience.BytesSenders`
  sull'op stessa. Superficie da 27 a 28 tool.
