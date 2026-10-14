# Sessione dell'editor: quattro giri invece di sei, un tocco una sessione

`frame_open_timing` da iPhone (09:17:26Z): `session_ms` 9293 su 9626 totali. Gli `edge_logs`
di Supabase dicono dove: dalle 09:16:59 un `DELETE /rest/v1/orgs` lanciato da una macchina
locale (teardown di un eval, service role) è durato 16,5 s ed è finito in `statement timeout`;
dietro di lui l'intero progetto ha rallentato (p50 `origin_time` 14 s alle 09:17:00, 2,3 s alle
09:17:15, ~50 ms alle 09:17:35). La sessione è caduta in quella coda: ogni giro verso il
database costava 2–5 s, e ne faceva sei in serie.

Cosa cambia:

- `loadEditorSession` attende solo auth → membership → tela in serie; nodo, raggiungibilità,
  head, token, asset, run, template, galleria partono insieme (`canvasScope` / `nodeLookup` /
  `motionOrThrow` in `editor-scope.ts`). Il controllo di accesso resta prima della risposta.
- Header `Server-Timing` sulla risposta di `/session` (scope, node, head, tokens, assets, runs,
  templates, gallery): il tempo per fase si legge dal browser.
- "Open editor" sul nodo, quando apre l'editor sulla tela, non precarica più la pagina intera
  (`data-sveltekit-preload-data="off"`): su iOS il touchstart lanciava una seconda
  `loadEditorSession` completa in parallelo a quella della sessione.

Scartato: rimuovere template/galleria/run dalla sessione. Non aggiungono giri (sono in
parallelo) e servono al primo render della shell.

Fuori da qui: 79 foreign key senza indice (advisor Supabase), tra cui `nodes.org_id` e
`nodes.actor_id`: sono ciò che rende lento il cascade di `DELETE orgs`.
