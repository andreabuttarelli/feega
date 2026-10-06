# Una composizione con un input non svuota più la tela

Prima: una tela con un nodo composizione collegato ad anche un solo nodo andava in crash
(`DataCloneError`) e restava vuota. `CompositionNode` passa a `nodeDoc` il nodo e le card così
come escono dallo stato della tela, cioè proxy di `$state`; `applyDraft` e `parseMotionDoc` li
clonavano con `structuredClone`, che sui proxy lancia. Il `$state.raw` su `sources` copriva solo
i doc caricati dal server, non il nodo.

Ora i doc si copiano con `cloneDoc` (round-trip JSON: un doc è JSON per definizione, sta in
jsonb), che tollera i proxy: la funzione pura non dipende più da chi la chiama. Stesso schema
corretto in `duplicateClip` (`timeline.ts`). Scartato `$state.snapshot` a ogni chiamante: la
regola sarebbe in N posti e il prossimo chiamante la dimenticherebbe.

In più ogni nodo della tela è dentro `NodeBoundary` (`svelte:boundary`): un nodo che fallisce il
render mostra l'errore al suo posto, con Retry, e il resto della tela resta in piedi.
