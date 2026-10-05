# view_frames e autocontrollo: due guasti veri

**Perché.** Nei giri reali del trailer `view_frames` rispondeva sempre «no editor preview answered»,
anche con l'editor aperto e il POST dei frame a 200.

**Causa 1, Storage.** Le policy di `canvas-assets` facevano `(storage.foldername(name))[1]::uuid`.
Dal 05/10 09:15 nel bucket ci sono 15 oggetti sotto `e2e-perf/...`: il cast fallisce su quelle righe
e ogni `list` di un client utente torna `invalid input syntax for type uuid: "e2e-perf"`.
`awaitFrames`/`awaitVerdict` ignoravano l'errore e aspettavano fino al timeout. Fix: migration
`20261005120000_canvas_assets_text_org.sql` (confronto come testo) e un errore di `list` ora
arriva all'agente con la causa.

**Causa 2, self-check.** Il secondo giro forzava `tool_choice: view_frames`; con il reasoning acceso
i provider lo rifiutano (`tool_choice ... not supported`) e il self-check moriva. Ora si forza solo
senza reasoning (`selfCheckChoice`).
