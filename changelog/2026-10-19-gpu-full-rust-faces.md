# gpu-full can shape with the Rust text core

`?faces=rust` (preview) or `--faces=rust` (parity harness) backs the TS `Face` with `TextCore`
from `packages/gpu-text`, built to `static/gpu-text` by `npm run build:gpu-text`. Default stays
fontkit. `fontLoader` takes the face engine as an argument; `engines.ts` maps the flag to it.
HarfRust shapes at 1/64 font unit (it rounds to whole units otherwise). At non-default weights
variable kerning differs from fontkit by a few units: HarfRust follows HarfBuzz, as the browser does.

Parity vs live HTML, fontkit → rust (mean SSIM): title 0.9978 → 0.9979, text 0.9948 → 0.9948,
kicker 0.9985 → 0.9985, caption 0.9983 → 0.9983, fonts 0.9950 → 0.9948, grotesk 0.9924 → 0.9924,
animators 0.9962 → 0.9962, painted 0.9959 → 0.9959, on-path 0.9958 → 0.9957.
