# Pen path outline follows the moved shape

Dragging a pen shape writes `transform.x/y`; `PenOverlay` placed points from `props` only, so
outline and points stayed at the original spot while the fill moved. New `pathSpace`
(`src/lib/motion/shape/space.ts`) maps path points local ↔ frame through `worldAt` on the
auto-laid-out doc — the same affine the selection box uses — so move, rotate, scale, parents and
auto-layout are covered. The overlay reads and writes points only through it. The renderer was
not touched: it already applied the transform.
