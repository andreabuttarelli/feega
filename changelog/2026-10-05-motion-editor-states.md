# Motion editor: stati vuoti, inspector di composizione, export

Quarto passo della spec di redesign (stati ed empty, P1/P2).

- Editor vuoto: nella preview un riquadro «Start with a template, a clip or a prompt» con
  Template…, Add element e Ask the agent (apre la chat dove sta su quel viewport, tabella
  `OPEN_CHAT`, e mette il cursore nel composer). Prima: preview nera e la riga camera tratteggiata
  come cosa più visibile.
- Timeline senza clip: riquadro tratteggiato «Press + Add…». Niente «Drop media»: la timeline
  non accetta file trascinati, scriverlo sarebbe una promessa falsa.
- Inspector senza selezione (o con più clip): le impostazioni di composizione, gli stessi campi
  del popover in barra, mai un testo vuoto.
- Stage scuro in dark mode; disabilitati con `--ui-ink-3` invece dell'opacità, che in dark li
  faceva sparire.
- Dialog export 520px: destinazione come segmentato Server | Browser, preset come lista di righe
  40px (nome + spec mono, selezione con barra accent), select bordati, CTA a destra.

Rimandato: chat (componente condiviso con la tela, va ridisegnato lì) e barra zoom della preview
(richiede di toccare `MotionPreview`, fuori da questo lavoro).
