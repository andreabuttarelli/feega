# Un solo motore per le composizioni

Prima le composizioni avevano due motori: il nodo della tela usava un renderer WebGL suo
(`canvas/composition/scene.ts`) con un export nel browser (`encode.ts`, `export.ts`,
mediabunny) dentro `CompositionEditor`, mentre `/app/compose` usava il motore motion. Ogni
miglioramento del motion (look, luci, 4K, formati, farm) mancava al nodo.

## Cosa cambia

- **Ogni layout è un template motion** (`template/builtins.ts`, `builtin:composition-<layout>`):
  campi per media, sfondo, camera, loop e **ogni impostazione del layout**. I campi possono
  ora puntare a una chiave annidata (`layoutParams.tiltX`) con `setField`.
- **Il nodo** mostra l'anteprima col player motion (`CompositionPlayer.svelte`, `nodeDoc`):
  i dati salvati nel DB sono letti al volo come doc motion, senza migrazione in scrittura.
  "Open editor" e il doppio clic aprono Compositions (`/app/compose?/fromNode`): editor,
  ExportDialog, render sul farm, formati.
- **Le anteprime della galleria** di Compositions usano lo stesso player.
- **Il ring** ha una sola resa, quella CSS del motore motion: card curve fluide, angoli
  arrotondati keyframabili. Tolte le parti WebGL che servivano solo al vecchio renderer
  (piegatura nello shader, `width`/`bend` nelle trasformazioni). Raggio e altezza di default
  più piccoli, così l'anello entra nel quadro.
- **Agente**: le composizioni si inseriscono e si regolano con `insert_template` e
  `set_template_fields`; il test di parità verifica che ogni impostazione di ogni layout sia un
  campo.

## Rimosso

`scene.ts`, `encode.ts`, `export.ts` e i loro test, `CompositionEditor.svelte`,
`CompositionPreview.svelte`, la pagina `dev/composition`, `createSceneWhenMounted` e gli helper
del vecchio editor.

## Verifica

Prima/dopo per ogni layout allo stesso istante (vecchio renderer WebGL contro motion): nove
layout identici al pixel visibile; il ring passa da card piatte con il retro specchiato a card
curve con il retro leggibile.
