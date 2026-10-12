# Floating media template (step 1, draft)

Second hand-made premium template: central title with word reveal (expo + soft settle, blur-in)
and 1–12 image/video cards in real 3D depth, drifting forever.

- **CSS 3D, not three.js.** Twelve flat quads need no shader; CSS keeps text crisp, spends no
  WebGL context (16-context budget) and renders in the same DOM pass as the title.
- **Resistance is physics, not easing.** Drift is a periodic driver fed through the steady-state
  response of a damped oscillator (gain and phase lag from `resistance`). Frequencies are integer
  multiples of 1/length, so drift loops exactly; more resistance = smaller, lagged motion.
- **Safe zone in the model.** Layout pushes cards out of the title box including drift margin;
  entrance flies along the line of sight so projected cards never cross the title. Tested per
  layout × aspect.
- **Loop.** With `leave`, everything recedes at the end so frame L = frame 0; with entrance off,
  drift alone loops.
- `custom-template.ts` holds the field/var builder; prompt-input keeps its own copy until #424
  lands, then moves onto it.
- Video cards seek to `t mod duration`; the renderer does not yet wait for the seek.
