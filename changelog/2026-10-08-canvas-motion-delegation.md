# La chat della tela delega i video motion

Prima la chat di progetto (`/api/v1/projects/{id}/agent`) non poteva lavorare su un video motion:
i ~120 tool dell'agente motion sono legati a un doc solo, e la chat della tela non li aveva.

Decisione: **delega, non i 120 tool.** `project-agent/motion-delegation.ts` espone alla chat le
stesse funzioni server dell'API/MCP (#261, #282), limitate al progetto (`findMotionNode` con
`place: { projectId }`):

- `list_motion_videos` → `listMotionVideos`
- `create_motion_video` → `startMotion` (ora accetta `format`, `near` e `actor`: il nodo va a
  destra dei nodi `near`, alla loro altezza) e, con un `brief`, parte subito il turno motion
- `ask_motion_agent` → `askMotion` in background; `media` (id di nodi o asset) si risolve
  sull'asset più recente prodotto dal nodo e finisce nel prompt come id di `list_assets`
- `get_motion_run` → `askStatus`, con attesa limitata (default 60 s, max 90) dentro il turno
- `view_motion_frames` → `motionFrames` (Chromium lato server); le immagini arrivano al modello
  via `toModelOutput`
- `render_motion_video` / `get_motion_render` → `requestRender` solo `Browser` (il server è
  spento da #266)
- `publish_motion_embed` / `get_motion_embed`

`askMotion` prende ora `agentKey` (la chat scrive `sidebar`, l'MCP resta `mcp`) e `choice`: il
turno motion gira sul modello scelto nella chat. Il thread resta quello dell'editor, così aprendo
il video si vede cosa è stato fatto. Crediti: il cancello della chat (`gateAiAction` /
`gateOrgAiAction`) vale anche per il turno delegato; moderazione e rifiuti restano quelli di
`startMotionTurn` e dell'embed, e tornano al modello come `{ error }`.

Verificato su dev con `anthropic/claude-haiku-5.5`: "make a 6 s title video saying hello" →
`create_motion_video` + `get_motion_run`, nodo motion con revisione 1, costo $0.01.
Con `openrouter/auto` il turno motion non è finito entro i 6 minuti e il reaper
(`expireStuckRuns`, `RUN_STALE_MS`) l'ha chiuso `expired`: vale anche per `/ask` via MCP.

Scartato: base64 dei frame fuori da `chat_messages.tool_calls` — oggi l'output del tool è
salvato com'è (≤6 JPEG da 960px).
