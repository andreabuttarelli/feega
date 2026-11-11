# Card bodies and ports stay put inside a label octave

After #1841 cached card bodies across zoom steps, every label zoom step below 100% still moved
each body down by the new label reach (`shiftDown` over all contours) and redrew ports, and the
`coreCards` derived re-ran `faceOf`/`genViewFor` for every node: ~57% of main-thread CPU while
zooming the heavy canvas.

Now:
- `cardBases` (face, ports, label, icon, tag) is derived apart from the zoom step; `coreCards`
  only adds the step and draws.
- The top chrome reach grows by octaves (24·2^k) instead of per step, and the moved body plus
  ports are cached per reach, so a step lays out only label and tag (`labelChrome`).
  World positions are unchanged; the frame box is taller only with transparent space.

Probe (`canvas-zoom-profile-probe`, pinned camera): zoom CPU 1361→835 ms on Chromium desktop,
2809→2358 ms at 4x CPU, 4x zoom fps 31→45, settled screenshots 0.000% different.

Not done: the overlay display list measured ~1% (not 17%: that share was card `tileChrome`);
Vello scene/encoding pooling in `gpu-core` is untouched.
