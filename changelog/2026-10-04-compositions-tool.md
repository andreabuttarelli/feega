# Compositions: strumento `/app/compose` sopra il motore motion

**Perché.** Il nodo `composition` della tela (griglia cinetica, carosello, elica, coverflow… nove
layout three.js) viveva solo dentro la tela: anteprima e export erano un renderer WebGL suo,
export solo nel browser, niente timeline, niente agente, niente render server.

**Decisione: (b), ricostruire sopra il motore motion, non incartare il vecchio motore.**
- Nuovo componente motion `Composition` (`motion/components.ts`): `layout`, `media[]`
  (`{assetId, kind}` immagini e video), `layoutParams`, `camera`, `cameraParams`, `background`,
  `loop`. Diventa un clip come gli altri: render server su Vercel Sandbox, export browser,
  timeline, trasformazioni/keyframe/maschere sul clip, agente motion (lo vede da `COMPONENT_IDS`).
- Fedeltà per costruzione: `canvas/composition/pose.ts` estrae da `scene.ts` il calcolo per
  fotogramma (commit di solo spostamento, `pose.test.ts` lo inchioda al vecchio calcolo inline).
  `hyperframes/composition.ts` cuoce un giro di pose (30 fps × `loop`) con le STESSE funzioni e
  lo shader in `shader.ts` condiviso; lo script nella pagina HyperFrames applica i numeri, non
  ricalcola. `composition.test.ts` confronta, per ogni layout, il cotto con `poseAt` ai
  fotogrammi campione (tolleranza 1e-3, arrotondamento a 4 decimali).
- Scartato: serializzare le funzioni di layout nell'HTML (`toString` di moduli con import non
  regge) e riscrivere i layout in CSS 3D (parità impossibile da garantire).
- Costo noto: il cotto pesa (explorer-grid con molte istanze × 180 fotogrammi ≈ 1 MB di JSON
  nella pagina). Accettabile per 6 s; per loop lunghi è il primo punto da ottimizzare.
- Video come texture: nel render server il fotogramma del video segue `currentTime` senza
  attendere `seeked` — come faceva la tela. Le immagini sono esatte.

**Lo strumento.** `/app/compose`: galleria dei nove template con anteprima animata (foto del
progetto, o tessere colorate se non ce ne sono), formato 9:16/1:1/4:5/16:9, composizioni recenti.
Un template crea un nodo `motion` sulla tela "Motion" (`startMotion`) con la prima revisione già
scritta (`startComposition`). `/app/compose/[nodeId]`: anteprima HyperFrames, media dal progetto o
upload (Storage → `registerUploadedAsset`), headline con colori brand, sfondo, logo, durata,
formato, parametri di layout e camera, "Open in motion editor", export con `ExportDialog` (server
prima, browser come ripiego) che salva l'asset. Salvataggio e render passano dalle action della
rotta motion esistente (`editorUrl?/save|render|renderStatus|exported`), non da copie.
`composition-draft.ts` traduce i controlli in doc e ritorno; tocca solo i clip `composition`,
`headline`, `logo` e lascia stare ciò che è stato aggiunto nel motion editor.

**I nodi vecchi.** Il nodo `composition` della tela resta com'è (dati, anteprima, editor, export).
Ha un pulsante "Open in Compositions": `openCanvasComposition` legge nodo e archi entranti e crea
sulla stessa tela un video motion con layout, parametri, camera, sfondo, durata (60 s max) e
formato portati di peso; i media collegati diventano `media[]` con il tipo vero dell'asset (la
tela trattava ogni media come immagine). Nessuna migrazione del DB: il nodo vecchio non cambia.

**Altro.** Le etichette dei layout e dei parametri passano dall'italiano all'inglese (erano le
sole italiane della UI). Il controllo `Managed` nell'inspector motion mostra i campi che si
modificano dallo strumento, con il link.
