# Nessuno screenshot nitido in primo piano nei launch film

**Prima.** Il controllo `screenshots` (stile LaunchFilm) guardava solo la timeline principale e
scattava sopra il 30% della durata. Il test reale su supasito.com ha mostrato screenshot nitidi
a 2, 4, 6 e 7 s, tutti dentro precomp di template: il controllo non li vedeva.

**Ora.** Ogni Image con un asset o Device3D con uno schermo, grande almeno un quarto del frame,
nitido (blur < 8) e visibile (opacità > 0.35), a qualunque livello di composizione e per
qualunque durata, è un problema. `StyleProblem` porta `severity`; `screenshots` è `error`
(tabella `SEVERITY` in `style.ts`), pronta per il gate di consegna.

**Scelte.** Un template col segnaposto vuoto non è uno screenshot: si giudica il riempimento.
`launch-ui-speed-ramp` e `launch-ui-tilt-zoom` restano, ma la descrizione dice che la cattura
vale solo come sfondo sfocato: per il primo piano servono UI ricreate (kit / recreate_ui).
Fixture: `src/lib/motion/fixtures/supasito-v1.json`, il doc della v1.
