# L'agente del motion editor, chiamabile da fuori

**Perché.** Un agente esterno via MCP non poteva modificare un video motion se non riscrivendo il
doc a mano: i 93 tool dell'editor non sono esposti, e non devono esserlo (costo di `tools/list`,
e un secondo motore da tenere allineato).

**Cosa.** Il turno dell'agente motion esce dalla rotta (`motion/turn.ts`, `startMotionTurn`):
stessi tool, stesso prompt, stesso thread di chat (`openNodeThread`), stessa revisione
(`saveMotionDoc`). La rotta dell'editor lo streamma; `POST /api/v1/motion/{nodeId}/ask` lo esegue
in background (`runInBackground`) e risponde 202 con un `run_id`, una riga di `node_runs`
(`params.kind = 'motion-ask'`, `actor_kind = agent`, `actor_id` = utente).
`GET /api/v1/motion/runs/{runId}` riporta reply, riepilogo, versione, costo, `editor_url`.
`GET /api/v1/motion/{nodeId}` legge il doc salvato (lo stesso `docSummary` di `get_motion_doc`).
Auth `resolveOrgCaller` (JWT o chiave), `writeAllowed`, `gateOrgAiAction`.

Il messaggio dell'agente esterno entra nel thread come `agent`/`mcp`. L'editor aperto si iscrive
in realtime alla riga `nodes` (`saveMotionDoc` aggiorna `docHeadRevision`): a una revisione
d'agente più nuova ricarica doc e chat.

MCP: `ask_motion_agent` (attende di default, fino a ~4 min), `get_motion_run`,
`get_motion_summary`. CLI: `feega motion ask`, `feega motion run`. `tools/list` da 20.162 a 23.740
caratteri (+~900 token); il tetto delle istruzioni del server passa da 1.900 a 2.000 caratteri.

**Scartato.** Esporre i tool dell'editor via MCP. Una tabella nuova per i run: `node_runs` basta,
e i render la ignorano già (filtrano per prefisso `motion-render:`).

**Limite.** Senza editor aperto non ci sono frame: `view_frames` e l'auto-controllo visivo sono
spenti nel turno esterno, e il check dei componenti custom risponde che serve l'editor.
