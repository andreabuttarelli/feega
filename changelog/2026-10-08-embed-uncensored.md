# Embed rifiutato nei progetti uncensored

Gli embed ospitati (PR #243) sono pubblici: un progetto uncensored non deve poterne pubblicare.
Prima nessun controllo, né nell'editor né nel tool `publish_embed`.

- **La regola**: `embedRefusal(mode)` in `src/lib/gallery/refusals.ts`, accanto alle regole della
  gallery, stessa capability (`Capability.Share`) e stesso codice `uncensored_not_publishable`.
- **Il cancello**: `embedSlot` e `publishEmbed` (`src/lib/server/motion/embed.ts`) ricevono il
  `mode` e rifiutano prima di toccare lo storage. L'endpoint risponde 403 col messaggio, che
  `InteractiveExport.svelte` già mostra; il tool restituisce lo stesso errore all'agente.
- `motionScope` espone `mode`; `MotionTurnInput.project` lo richiede.
