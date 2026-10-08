# Editor motion: 44px a dito, il clock ha un menu

Ticket T1 di `touch-editor/SPEC.md`. Con `pointer: coarse` ogni bottone, link, select, input,
slider e checkbox (attraverso la sua label) dell'editor è alto almeno 44px, i bottoni anche
larghi. La regola sta in un posto solo, la pagina dell'editor (`.editor :global(...)`), non
sparsa per componente. I clip della timeline fanno eccezione solo in larghezza: la larghezza è
tempo. Timeline: righe, lane delle proprietà, ruler, twirl e flag a 44px.

Il clock non commuta più al tap senza dirlo: apre un menu Timecode / Frames (`DISPLAY_NAME`),
`nextDisplay` è sparito. Popover (impostazioni composizione, clock) si chiudono a un tap fuori,
non all'inizio di uno scroll (`isTap`, 8px).

I glifi ↑ ↓ × ↯ dell'inspector sono `IconButton` con nome e tooltip (`Tool.ItemUp/ItemDown/
Remove/Shuffle/InOrder`). Icone: Null parent da mirino a cerchio tratteggiato, Precompose da
livelli a gruppo. Hide/lock restano coerenti: icona = stato, nome = azione.

Test: `tests/e2e/motion-touch.spec.ts` (`@real`, `hasTouch`, 390/820/1180) cammina ogni
controllo dentro `[data-testid=motion-editor]`; prima del cambio trovava ~400 controlli sotto i
44px. Disegnati piccoli per scelta (trim, keyframe, fade, whip, range) sono in allow-list: li
prende T4.
