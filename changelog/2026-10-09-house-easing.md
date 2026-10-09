# Motion: house easing, expo with a soft settle

**Before.** The default curves were mild: a tween with no ease ran on quad-out, keyframe
`standard` was quart-out, `enter`/`exit` cubic. Style eases were plain beziers, recipes popped on
`overshoot` (back.out 1.7, ~10% past the mark), the device spin-in swung ~33° past its rest.
Nothing named a linear entrance or a `sine.inOut` tween in a custom component.

**Now.** One registry row, `feega` in the engine's `FAMILIES` (`engine.ts`):

- `feega.out` = expo-out + `0.2·p⁶·(1−p)`: 82% at a quarter, peaks ~1.1% past the mark, settles.
- `feega.inOut` = expo-in-out + `0.35·p¹²·(1−p)`: 1.2% at a quarter, 99% at three quarters,
  peaks ~1%.
- `feega.in` = expo-in, for exits.

Pure functions of time; `sampleTrack` carries the same formulas (it is serialised into the page,
so it can't import them) and a test holds the two equal. Keyframe `standard`/`enter`/`exit` map to
`feega.inOut`/`feega.out`/`feega.in`; the engine default is `feega.out`; `STYLE_EASES` are the house
eases for every style; the blur hold, custom `ease` params, the slider layout follow. Recipes and
device presets lost `overshoot`. `SPRINGS` were already ≤1% overshoot: unchanged.

**Gate.** `Forbidden.WeakEase` (warning, every style): a 0.15–2 s keyframe move faster than a
drift on a near-linear curve, or a component tweening on a weak (sine, power1) or bouncy
(>2% past, elastic, back) ease. `'none'` in code stays allowed: it drives loops.

**Not changed.** The text-animator selector shape (smoothstep per unit) and the linear preset
sweep: the sweep is a stagger, guarded by #314. Cursor travel in the UI kit.

Curves and before/after: `~/Documents/feega-videos/easing/`.
