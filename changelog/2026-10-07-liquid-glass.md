# LiquidGlass: una goccia di vetro che rifrange ciò che sta sotto

Componente nuovo del motore, `LiquidGlass`, e tool `add_liquid_glass`. Prima un effetto vetro si
poteva solo scrivere a mano in un Custom con `backdrop-filter`, che sfoca ma non rifrange.

- **Come**: è un gruppo come l'Adjustment (`firstLayer: 0`): avvolge tutte le tracce sotto in un
  div con `filter:url(#lgf-…)`. Il filtro SVG prende una mappa di spostamento radiale (PNG 128 px
  generato in TS, `lensMapUrl`, senza deflate) → `feDisplacementMap` (ingrandisce al centro,
  piega forte al bordo) → `feGaussianBlur` (frost) → `feComposite in` col disco → sopra la
  sorgente. Il bordo luminoso (gradiente verticale 0.45/0.15/0/0/0.15/0.45 della specifica CSS),
  la luce interna, l'highlight speculare e l'ombra sono un SVG sopra, fuori dal filtro.
- **Deterministico**: posa per frame calcolata in TS (`glassPose`: keyframe, wobble sinusoidale
  sul tempo) e scritta come `tl.set` di attributi, come `effectTimeline`. Niente `@keyframes`,
  `transition` o runtime: il seek dà lo stesso frame. Il movimento a molla passa per le
  espressioni `spring()` già esistenti, quindi resta modificabile.
- **Perché non `backdrop-filter`/`mask-composite`**: misurati con la CSS dell'utente, Chrome e
  html-to-image 1.11.13 li disegnano uguali (PSNR 39,6 dB), ma `backdrop-filter` non sa
  spostare pixel: la rifrazione richiede un filtro sul contenuto. Il bordo `::before` con mask
  xor diventa uno stroke SVG a gradiente, più semplice e uguale ovunque.
- **Parità** (video demo 1080p, 4 frame): preview↔html-to-image 38,7–39,6 dB, preview↔producer
  locale 38,7–41,3, html-to-image↔producer 37,1–37,9. I frame con la goccia stanno nella stessa
  fascia del frame senza (1,2 s): la differenza è codifica JPEG/H.264, non il vetro.
- **Limiti**: `feDisplacementMap` in Chrome campiona senza interpolazione e la mappa è a 8 bit:
  i bordi delle lettere ingrandite hanno piccoli gradini. Li attenua un blur della mappa (3 texel)
  e un frost ≥ 1,5 px. Le trasformazioni del clip non valgono (sposterebbero ciò che sta sotto):
  si anima con `centerX`, `centerY`, `diameter`.
- **Scartato**: copia clonata del DOM sotto un clip circolare (id duplicati per GSAP, costo per
  frame) e anelli concentrici a scala diversa (bande visibili sul testo).
