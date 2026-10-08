# Componenti custom live

Un componente custom può dichiararsi `live` (`mode: 'live'` su `write_component`, casella *Live*
nel tab Code): gira col suo loop e legge l'input, diverso a ogni visione. Serve per giochi, pezzi
generativi, hero interattivi — cose che non sono un video e per cui l'export interattivo esiste.

- **Una tabella decide cosa si rilassa**: `ALLOWED` in `custom/lint.ts` mappa modo → concern
  permessi (`clock`, `chance`). Ogni regola del lint porta il suo concern; `sandbox` (rete,
  storage, editor, eval, window) resta vietato per tutti.
- **Una tabella decide come gira**: `PLAY` in `compose.ts` mappa `Target` (video / schermo) ×
  modo → `Play` (`seeked`, `live`, `still`). Lo schermo (preview dell'editor, nodo sulla tela,
  bundle interattivo, embed) fa girare il live; video, frame del server e seek check ricevono
  `still`.
- **Live a runtime**: timer, `requestAnimationFrame`, `Math.random`, `Date`, `performance` veri ma
  tracciati: i frame restano in attesa quando la radice non è visibile (clip fuori tempo, tab
  nascosta), tutto viene cancellato al boot successivo (patch della preview). Nel contesto:
  `input` (pointer, tasti, tilt), `onPause`/`onResume`/`onDestroy`.
- **Input dal player**: il player dell'embed inoltra pointer e tasti (`feega:event`); il runtime
  li ridispaccia come eventi DOM, così li legge anche un motore di gioco che ascolta `document`.
- **Still**: `Math.random` seminato per clip, orologio fermo a 0, un solo frame di `rAF`, timer
  mai; se il corpo restituisce `{ still(t) }` lo chiama a ogni seek.
- `mode` è opzionale nello schema (`modeOf` → deterministic): i doc esistenti non cambiano, e lo
  stamp del check cambia solo quando un componente diventa live.
- Nell'editor l'input diretto non arriva (gli overlay di selezione stanno sopra la preview): il
  live gira con il badge *live*, si gioca dall'anteprima Embed.
