# Opening a frame node is fast on phones

Measured with `tests/e2e/motion-open-perf.spec.ts` (production build, 4x CPU, slow 4G).

- `/session` carried 1.27 MB of built-in templates the bundle already ships; now only the org's. Editor shown 1649 -> 504 ms.
- Player chunk and frame runtime were a serial chain after the session; now prefetched when idle and on open. First frame 2163 -> 981 ms. Desktop 482 -> 468 ms.
- The editor picture lagged its node during reframing (rAF ran before the canvas transform); it now re-places on ancestor mutations.
- `vite preview` sends the CORS header `/motion-libs` needs, as dev and Vercel do.

Discarded: budgeting server TTFB (too noisy).
