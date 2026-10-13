export const WIRE_CSS = String.raw`
.wg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--wg-bg);
}

.wg-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.wg-sources {
  position: absolute;
  left: 0;
  top: 0;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}
`;
