# Each particle's fixed traits are computed once

`particlesAt` is closed-form per particle, but it rehashed every particle's seeds (life,
spawn point, heading, speed, size variance, rotation, sway phase: eight `rand` calls and a
sin/cos) on every frame. These depend only on the particle index and its birth row, both fixed
by the bake.

- `particlesAt(bake, t, memo)` keeps them in a `Map` by index; the runtime owns one per
  emitter. Without a memo the function is unchanged, so export and tests keep calling it bare.
- Output is bit-identical (unit test compares with and without memo over out-of-order frames;
  asteroids frames pixel-identical).
- Asteroids embed, Chromium 4× CPU: median ~43 → ~37 ms.
