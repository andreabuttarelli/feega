# gpu-full draws tracking text animators

Tracking animators were the last text animators gpu-full named instead of drawing. Positions do
not depend on geometry, so the spacing of every character is known before layout: `layOut` takes
an `Extra` (em per character) and reflows with it every frame, on a path too. As on the page,
`.tu{letter-spacing}` replaces the text's own tracking inside the animated units instead of adding
to it: the first parity run (adding) was 0.9721, replacing is 0.9968.

Parity (`kinds.ts tracking`, `--ref=live`, 4 frames): mean SSIM 0.9968, worst 0.9955.
