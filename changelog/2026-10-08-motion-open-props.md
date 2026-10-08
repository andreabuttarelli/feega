# Open Props (sottoinsieme) nei componenti custom

Open Props 1.7.23 (MIT, Adam Argyle) arriva come token, non come CSS di animazione:

- **Token CSS** su `:root`: `--size-*`, `--shadow-*` (senza `--inner-shadow-*`, niente bagliori,
  niente varianti `@media`), `--gradient-*`, i valori delle easing. Niente `--noise-*`: la grana
  sta in `fx.grain`.
- **Easing registrate sul motore** con `registerEase`: `ease: 'ease-out-3'`, `'ease-spring-2'`,
  `'ease-elastic-out-3'`… funzionano su `tl`. `cubic-bezier()` (Newton + bisezione), `linear()`
  (con le posizioni mancanti distribuite come da spec) e `steps()` sono interpretate da codice
  nostro, nessun parser preso altrove.
- **`OpenProps.animate(el, nome, { at, duration, ease, iterations })`** legge i suoi `@keyframes`
  e li trasforma in tween su `tl` (i `transform` a una funzione diventano `xPercent`, `yPercent`,
  `scale`, `rotation`; una chiave mancante a 0% o 100% torna all'identità). Il lint continua a
  rifiutare `@keyframes`/`animation`/`transition` nel CSS dei componenti.
- **Caricato solo se usato**: il js nomina `OpenProps` o una sua easing, oppure il css legge
  `var(--size-…|--shadow-…|--gradient-…|--ease-…)` — `librariesOf` ora guarda anche il css, con
  una tabella `STYLE_USES` a parte.
- Inlineato come gli altri (`open-props-entry.ts`, `virtual:motion-open-props`, 27 KB; test < 32 KB).
- Trovato nella demo: un `transformOrigin` messo nei vars di un `fromTo` dà un frame diverso alla
  seconda visita (stringa interpolata da un inizio letto in modo diverso). Va nel CSS o in `tl.set`.
- Verificato: demo con `write_component`, 7 frame da Chromium locale, visite ripetute identiche al
  byte (`~/Documents/feega-videos/css-libs/open-props/`).
