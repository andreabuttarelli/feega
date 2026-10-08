# Editor senza bordi

Feedback: l'editor motion sembrava vecchio, pieno di bordi e divisori; i toggle Chat/Properties
nella barra duplicavano le tab della colonna laterale (#247); la barra a 1100–1440px faceva
collidere trasporto e azioni; i bottoni icona erano troppo piccoli e attaccati per il touch.

- **Token** in `src/app.css`: `--ui-text-2/3` (inchiostro al 60/40%), `--ui-field` (superficie
  piena degli input), `--ui-raised` (menu, dialog, fogli), `--ui-grid` (hairline della timeline),
  `--ui-hit` (32px, 44px su pointer coarse) e `--ui-hit-gap` (8px).
- **Editor**: `.editor` rimappa `--ui-ink-2/3` sulle opacità e azzera `--ui-line`,
  `--ui-line-strong` e `--border`. Una regola sola tocca tutti i componenti figli; i bordi
  restano solo dove servono (tick del ruler, contorno degli swatch colore, accento sul focus).
  Input, select e textarea riempiti con `--ui-field`. Tablet e phone forzano `--ui-hit: 44px`;
  phone `--ui-hit-gap: 12px` e nasconde i passi frame (il trasporto non entrava in 390px).
- **Toggle**: in barra solo quando la chat non è in colonna (tablet). Desktop usa le tab,
  phone la barra in basso; ⌘B/⌥⌘B invariati.
- **Barra**: griglia `1fr auto 1fr`; sotto 1440px il chip composizione è corto, sotto 1360px
  Template/Publish (e scorciatoie, slider zoom della timeline) passano nel menu `⋯`.
- **Chat**: `ChatPanel`/`ChatComposer` leggono `--chat-field`/`--chat-gap` (fallback invariato,
  la chat del canvas non cambia).
- Test: `tests/e2e/motion-editor.spec.ts` — nessun toggle e centro/destra senza sovrapposizione
  a 1100 e 1280, cassetto chat da tablet, chat dalla barra in basso su phone.

Scartato: nascondere i bordi componente per componente (decine di valori locali che divergono).
