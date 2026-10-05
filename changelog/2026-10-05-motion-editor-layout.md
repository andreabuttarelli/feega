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

Comportamento di play, scorciatoie e pannelli invariato.
