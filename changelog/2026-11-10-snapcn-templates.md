# snapcn components as motion templates

The 61 free (MIT) snapcn components — Remotion/React product-demo animations — are ported to feega
custom components and listed as builtin templates `builtin:snapcn-<id>` (editor library, `list_templates`
/ `add_template` for the agent). The 81 Pro components are not included.

How: `packages/motion-core/src/motion/snapcn/` holds a self-contained kit (frame tweens with clamp/extend,
analytic damped spring with Remotion's `durationInFrames` stretch, cubic bezier, mulberry32 random, oklch
mixing, the snapcn light/dark tokens, a `h()` DOM builder taking React-style style objects) and one port per
component. A port is a `draw(S, view)` that builds DOM and returns `render(frame)`; it is serialised with
`Function.toString`, so it may reference only its arguments. The catalog auto-discovers port files.

Rejected: bundling the TSX with a React/Preact shim (the brief excluded React and Remotion); a stateless
per-frame `innerHTML` renderer (snapcn measures text after layout).

Parity: each port was rendered against the original in Remotion (local Chrome, same size/fps/frames) and
diffed with pixelmatch. Most frames are 0%; the residue is antialiasing. Gaps: snapcn's remote demo media
(media.snapcn.dev) is blocked by the compose CSP, so media defaults are empty placeholders and media frames
were verified with data-URI images on both sides; remote video is not verified. Fonts load only when a Font
prop names them, so ports default their Font prop to the real family and turn Inter's opsz off.

Notices for snapcn (MIT) and Paper Shaders (Apache-2.0, pulsing-border) are in THIRD_PARTY_NOTICES.md.
