# Testo inclinato e tagliato: il gate guarda anche dentro le scene

Test supasito.com: a 6–7 s la cattura del sito restava inclinata di 18° (`launch-ui-tilt-zoom`, `rotateX` fisso nel transform, la descrizione diceva "si raddrizza" ma non lo faceva) e il testo era illeggibile. `out-of-frame` di #196 non lo vedeva: legge solo le clip del timeline principale, e le scene dei template stanno in un Precomp.

- `placedClips` porta nel gate le clip dei Precomp, spostate al tempo del film; `out-of-frame` le usa.
- Nuovo `tilted-text`: testo, UI e immagini tenuti oltre 12° in `rotateX`/`rotateY` fuori dall'ingresso (0,35 s ai bordi).
- `launch-ui-tilt-zoom` entra a 18° e si raddrizza in 0,35 s.

Scartato: il controllo del titolo sdoppiato in dissolvenza (4–4,5 s) — serve un confronto di testi sovrapposti fra scene, non economico qui.
