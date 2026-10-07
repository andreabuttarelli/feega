# Launch film: lo stile di default diventa minimale ma ad alta energia

I video dub.co dell'agente sono stati bocciati due volte: v1/v2 "PowerPoint", v3/v4 "Apple
minimal" letto come lento e statico. Il gate Apple minimal vietava rotazioni, testo in movimento,
più di due elementi in moto e la transizione zoom: proprio le tecniche che rendono dinamico un
film di lancio. Il golden fatto a mano (scratchpad `dub-launch/golden/`) ne prendeva 12.

- **`MotionStyle.LaunchFilm`** (default): look minimale (nero, tipografia enorme, prodotto vero,
  un accento) ed energia alta. Testo in 0,2–0,35 s, scene 0,8–2,5 s, ease `move` whip
  `cubic-bezier(0.83,0,0.17,1)` per gli speed ramp, fermo massimo 0,5 s, fino a 4 cose in moto.
  Rotazione e testo che vola non sono più vietati.
- **Gate**: due controlli nuovi a livello di video. `off-beat`: con i marker `beat N`
  (`mark_beats`) ogni taglio sta entro 2 frame da un beat. `no-peak`: un film di 6 s o più senza
  una mossa grande (scale ≥ 60 %, zoom ≥ 0,8, dolly ≥ 0,5, rotazione 3D ≥ 90°) viene nominato.
  `zoom`, `dolly`, `orbit` contano come movimento per il controllo "fermo". I check ora leggono
  il doc intero (refactor in commit separato).
- **Libreria**: nove scene `builtin:launch-*` prese dal golden (word burst, speed-ramp zoom nella
  UI, device fly-in, number match cut, UI tilt zoom, beat montage, UI explosion, device orbit,
  logo build).
- **Prompt**: niente più "dynamic significa più cura, non più effetti"; la struttura del trailer
  usa le scene launch; detto che x/y nei keyframe sono offset.

Apple minimal resta, calmo, con le sue regole di prima, per chi lo chiede con `set_style`.
Scartato: modificare la riga Apple minimal (lo fa già il branch Deep, si sarebbero scontrati).
