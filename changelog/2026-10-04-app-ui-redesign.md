# Un solo sistema visivo per dashboard, strumenti, tela e editor motion

**Perché.** Feedback: troppo grigio, barre nere accanto a pagine grigie, timeline motion senza
distinzione fra tipi di elemento e barre poco leggibili.

**Cosa cambia.**
- Token `--ui-*` in `src/app.css` (superfici, linee, inchiostro, accento `#0099ff`, scala di
  spazio e testo, mono). Regole in `docs/design/app-ui.md`.
- `.ui-app` sugli shell `/app` e `/p` rimappa `--accent` al blu: chat e componenti condivisi
  seguono senza toccarli uno per uno.
- Pagina bianca, primari blu, selezioni come lavaggio d'accento. Share della tela blu,
  Promote secondario.
- Fragment Mono self-hosted (`static/fonts/fragment-mono-latin.woff2`): prima era citato ma
  mai caricato.
- Timeline: tabella famiglia→colore/anteprima in `src/lib/motion/track-style.ts` (testata);
  header traccia con chip colorata, collasso, riordino al passaggio; righe alternate; righello
  mono; playhead con testa; keyframe vuoti, pieni d'accento se selezionati.
- Anteprime: immagine a tessere, filmstrip video (`filmstrip.ts`: ≤24 frame per asset, coda
  unica, cache per URL, avviata da IntersectionObserver), waveform audio già decodificata una
  volta.

**Scartato.** Lock/hide/solo per traccia: il documento motion non ha questi campi e il renderer
non li conosce; aggiungerli è un cambio di modello, non di presentazione. Cambiare `--accent`
globale: avrebbe toccato le pagine marketing.
