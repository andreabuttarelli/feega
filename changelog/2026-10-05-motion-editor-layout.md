# Motion editor: timeline a tutta larghezza e barra con trasporto

Primo passo della spec di redesign dell'editor (layout e barra superiore).

- Layout: la timeline scende sotto preview e inspector e prende tutta la loro larghezza; la chat
  (360px) occupa l'intera altezza a destra. A 1440 con chat chiusa la timeline passa da 780 a
  1440px. Inspector 300px, timeline 360px di default, splitter sul bordo superiore.
- Barra 44px (`--ui-bar-h-dense`) in tre gruppi separati da hairline: breadcrumb
  `Tela / Nome / Comp` (assorbe la vecchia breadcrumb delle precomp), trasporto centrato
  (inizio, frame precedente, play, frame successivo, fine, timecode), impostazioni.
- Impostazioni di composizione (formato, durata, fps, background, motion blur) in un chip
  `16:9 · 1920×1080 · 30fps · 28s` che apre un popover (`CompositionSettings.svelte`):
  si cambiano una volta, non meritano la barra.
- Timecode `mm:ss:ff` invece di `m:ss.ff`, che si leggeva come un decimale; clic per vedere i
  frame. Stato di salvataggio con quadrato colorato da una tabella (`SAVE_TONE`).
- Toolbar timeline 32px: Add, editing, undo, `Clips | Graph`, snap, marker e work area con
  icona invece di «M» e «[ ]», Arrange solo con due o più clip selezionate.
- ThemeSwitch tolto dall'editor. Nuovi token `--ui-ok/warn/danger`, `--playhead`.

- Telefono e tablet da una tabella (`viewportOf`, `CHAT_PLACE` in `editor-layout.ts`): sotto
  760px preview in alto, timeline sotto, trasporto in fondo vicino al pollice, inspector e chat
  come bottom sheet; 760–1099px inspector a colonna e chat come drawer; da 1100px colonne. Su
  puntatore touch bottoni e strumenti a 44px.
- Zoom della timeline anche come slider (scala logaritmica), oltre a −/+.
- `selection-context.ts`: la pagina espone ids e clip selezionata via context, così inspector e
  overlay della preview leggono la stessa fonte. `SelectionOverlay` (#140) legge e scrive la
  selezione solo da lì: niente più prop `selection`/`onselect` paralleli.

Comportamento di play, scorciatoie e pannelli invariato.
