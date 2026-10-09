# Safari exports keep every 3D layer, on one lane

#337 applied grain with a WebGL2 context per capture lane. A full 465-frame export of the
asteroid doc in WebKit with 4 lanes came out with 3 of 5 asteroids missing on many frames:
5 three.js canvases per lane plus the grain context went over WebKit's live WebGL context
limit, and WebKit dropped the oldest contexts (the asteroids). 24-frame parity runs on one
lane never saw it.

- Grain is now a CPU pass (`effects/grain.ts`, `grainPixels`) over the filter region's
  bounding box only, same math as the shader (parity unchanged: mean 0.4 levels). No capture
  code creates a WebGL context any more.
- `paintSvg` waits up to 120 ticks (not 12) while the frame is still fully transparent: a pass
  made only of a nested picture is blank until WebKit loads it.
- WebKit exports on one lane (`laneCount(info, engine)`, `engine.ts`): its lane iframes share
  one thread, so lanes only queue. Measured on the asteroid doc: 4 lanes 5.6 s/frame, 1 lane
  2.3 s/frame (baseline 4 lanes 4.9 s). `engine.ts` is also where the capture runtime's
  "filters are painted in software" test comes from.
