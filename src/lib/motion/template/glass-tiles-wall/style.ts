export const GTW_CSS = String.raw`
.gt {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: radial-gradient(120% 90% at 50% 45%, color-mix(in srgb, var(--gt-bg) 82%, #3a4470), var(--gt-bg));
}

.gt-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.gt-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(140% 110% at 50% 50%, transparent 55%, color-mix(in srgb, var(--gt-bg) 70%, transparent));
}
`;
