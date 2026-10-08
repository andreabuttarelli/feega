# Una scena live nel video: lo dice il gate, lo dice l'export

Una scena live non si può cercare: nel video, nei frame del server e nel poster gira il suo
still seminato (`still(t)` o il primo frame). Che quello still non sia la scena lo dicono due
posti, con lo stesso testo (`liveNote` in `custom/determinism.ts`):

- **Quality gate**: `Quality.LiveScene`, severità `Warning` (non blocca: il video è legittimo,
  solo diverso), al secondo della prima clip del componente. L'agente lo legge in `view_frames`.
- **Dialog di export, ramo video**: avviso `export-live` con un link che porta al ramo Embed.

Scartato il blocco dell'export: chi vuole davvero un video di una scena live (un teaser del
gioco) deve poterlo fare.
