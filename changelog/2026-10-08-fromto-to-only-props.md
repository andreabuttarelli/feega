# Engine: a prop only in the `to` vars of `fromTo` tweens from the current value

**Before.** `fromTo(el, { scale: 0 }, { transformOrigin: '50% 0%', opacity: 0.5, scale: 1 })`
recorded `from: undefined` for every prop missing from the from-vars, with `lazyFrom: false`.
`interpolate(undefined, b)` returns `undefined` until the end, and `apply` skips `undefined`:
before the end the engine wrote nothing, so the element kept whatever the last seek left.
Visiting t=0.8, then t=2, then t=0.8 again drew two different frames. Reported on
`transformOrigin`; any prop (opacity included) had it.

**Now.** Such a prop is resolved lazily like a `to` tween (GSAP semantics: from the value the
timeline holds at the tween's start). Props in both vars, and `to`/`from`/`set`, were already
deterministic; the test `a revisited frame` covers all five shapes.
