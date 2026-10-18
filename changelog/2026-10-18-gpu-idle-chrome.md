# GPU canvas: idle nodes' ports and labels drawn on the GPU

Every node's DOM ports, port names and name tag sat over the WebGPU
canvas. Chromium cannot merge DOM over a composited canvas, so it kept
one compositor layer per element (234 on the heavy canvas copy) and
rebuilt them on every change: ~18 ms of layerize per click.

- Idle nodes get ports (10 px squares, connector colour) and the name
  tag (kind icon rasterised once per kind, tinted) from a Pixi layer
  above the cards. DOM chrome stays only for the selected, hovered,
  connecting or DOM-painted node. Layers: 234 -> 77.
- Connect gestures already used geometric ports, so nothing interactive
  moved. Specs that measured DOM ports now select the nodes first.
- Tried and dropped: `will-change` on the pane or viewport, shelf
  z-index, left/top instead of transforms, transparent DOM handles. A
  non-painting positioned element still costs a layer; only removing it
  helps.
- Label overflow is clipped, not ellipsised.
