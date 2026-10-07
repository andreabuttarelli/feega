# Effetti dalla chat della tela, in parità con MCP

Prima la chat della tela non aveva strumenti per gli effetti; MCP aveva solo `apply_effects`, che
richiedeva di scrivere la pila con `update_row` e un nodo `effects` già collegato.

Un solo percorso server, `src/lib/server/canvas/effects-actions.ts`:

- `applyEffectsTo`: su un nodo immagine crea un nodo `effects` accanto, lo collega
  (`target_handle: images`) e rende la catena; su un nodo `effects` sostituisce la pila (validata
  con lo schema del tipo) e rende. Finisce sempre in `applyEffectsNode`.
- `makeEffectsPair`: il gemello A/B di un nodo con `shape-cutout`, collegato alla stessa sorgente.

Lo usano tutti: tool di chat (`list_effects`, `apply_effects`, `make_effects_pair` in
`project-tools.ts`), rotte `/api/v1/org/effects`, `/org/nodes/:id/apply-effects` (ora accetta
`{ effects }` e risponde `{ node_id, asset_id }`) e `/org/nodes/:id/effects-pair`, tool MCP con gli
stessi nomi, e il bottone "Make A/B pair" della tela (action `effects_pair`, che sostituisce la
sequenza create/connect/apply fatta nel browser).

`list_effects` deriva dalla tabella `EFFECTS` (`effects/catalogue.ts`). `effects-parity.test.ts`
fallisce se un tool effetti esiste da una parte sola o con campi diversi.
