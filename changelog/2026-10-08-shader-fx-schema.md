# `@feega/shader-fx`: custom effect schema, lint, prelude

First piece of AI-written custom effects (spec `custom-effects-and-layouts.md`, ticket 2).

**What.** A pure package, no `$lib`: `parseEffect` (zod: kebab name, frag ≤ 12 KB, ≤ 12
params of kind `number`/`color`/`seed`, `min < max`, default in range, unique identifier
keys), `lintFrag` (one row per rule in a `Record<LintRule, Check>`: no `#extension`, no
off-spec WebGL1 calls, `for` bounds constant ≤ 64 and no `while`, ≤ 16 `texture2D`, no
authored `uniform`, no unknown `u_*`, `vec4 effect(vec2)` required) and `buildFragment`,
which injects the fixed contract (`u_src u_res u_time u_seed v_uv`, seeded `hash`/`noise`, one
uniform per param, `main` calling `effect`).

**Why a package.** The same effect runs in the canvas effects node, the motion clip stack and
server frames; the validation must be one, not three.

**Not yet.** GL compile/draw (ticket 1, on TWGL from #290), storage, tools.
