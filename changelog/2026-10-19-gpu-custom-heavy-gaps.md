# gpu-full: the custom-component gaps on the heavy canvas

A gap report across the 57 motion frames of the heavy canvas copy (`scripts/gpu-parity`, one
run per frame) ranked what was still left out. This change covers everything in that report
that belongs to custom components, plus two Shape gaps.

- **Custom clips later in the timeline were read hidden.** The DOM probe seeked only the GSAP
  timeline, while clip visibility belongs to the hyperframes player. A clip that starts later
  came back `visibility: hidden` and drew nothing, with no gap reported (a2aaeadc 0.65 → 0.99
  at 10.9 s). The probe now seeks through `__player.renderSeek(t, { exact: true })`, as the
  exact-seek bridge does.
- **Nested groups** (a faded group inside a clip group) each get their own raster target
  instead of clearing the outer one.
- **z-index**: positioned siblings stack by z-index, negative ones under the flow.
- **Opacity over a group**: when the items don't overlap, each one is faded. When they do,
  the read returns a `group` and the raster composites it once.
- **`clip-path: inset()`** becomes a mask.
- **box-shadow** (outer, any count): blurred by half the radius, painted under the box.
- **Mask keyframes** (`maskX`…) on any clip and **modifier keyframes** (`mod.<id>.<param>`)
  on shapes are sampled instead of refusing the clip.
- **Fonts**: the loader also fetches the subsets for characters in custom components' props and
  source. Text a loaded face doesn't cover (✓ in Inter) is rasterised by the probe.

Still missing on the heavy canvas: LiquidBlob (6 frames, WebGL refraction), Device3D (2),
Composition (1), background images the box painter can't read (`div.paint`), and an
unloaded Kicker glyph.
