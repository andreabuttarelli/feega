# gpu-full turns text about the box the page renders

A text clip's `rotation`/`scale` turned about the centre of `boxOf`, but the page turns the `.box`
it renders: the safe box for a Title, the laid height for auto-height Text, the laid width and
height for auto-width Text. A title near the frame edge rotated about the wrong point. The text
painter now returns that box and the turn is built from its centre.

Parity (`kinds.ts pivot`, `--ref=live`, 4 frames): mean SSIM 0.9930, worst 0.9911, ≤0.53% pixels off.
