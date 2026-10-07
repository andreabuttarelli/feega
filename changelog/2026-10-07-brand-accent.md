# Accento del brand letto, mai inventato

Nel test supasito la cattura del sito dava solo neutri (`#FAFAF9`) e l'agente ha dichiarato un arancio scelto da sé: giusto per caso, perché l'arancio c'era nei bottoni. `analyze_site` ora restituisce `accent`: il primo colore saturo fra logo, favicon, theme-color, regole CSS di bottoni e link, custom properties (tabella `ACCENT_ORDER` in `src/lib/motion/accent.ts`, documentata in CONTEXT.md). Se non c'è, `hex` è null e arriva una palette neutra; il prompt vieta di inventare un accento.

Scartato: derivare l'accento dall'og:image (foto, non brand) e scegliere un colore "adatto al settore".
