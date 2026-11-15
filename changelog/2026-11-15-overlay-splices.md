# Overlay changes cross to the core as splices

On landings, `set_overlay` resent the whole fixed overlay (~981 KB) and
`set_selected_overlay` ~229 KB on every selection change. The core now takes a
head/tail splice per overlay part (`splice_overlay`, `splice_selected_overlay`,
`splice_live_overlay`), and `core-web.ts` sends only the items between the
unchanged head and tail, compared by identity. A core without the entry points,
or one that refuses a splice that does not fit, gets the whole part as before.

A splice whose items equal those already there answers `Same` and does
nothing: the first version re-grouped the live overlay on every gesture frame,
because a splice bypassed the repeated-payload check of `set_live_overlay`, and
cost ~15% of desktop pan fps.

Not done: f32 contours for `append_group_packed`. Precision is not the issue
(vello encodes in f32 anyway; at 15,000 px an f32 step is ~0.001 px, 0.008
screen px at the max zoom 4 × DPR 2), but the core stores contours as f64, so
f32 on the wire alone saves one memcpy-speed copy at load; the gain needs f32
storage end to end.
