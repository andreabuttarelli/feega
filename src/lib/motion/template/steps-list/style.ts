export const STEPS_CSS = String.raw`
.stl {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: radial-gradient(120% 90% at 50% 20%, color-mix(in srgb, var(--stl-bg) 88%, #ffffff) 0%, var(--stl-bg) 55%, color-mix(in srgb, var(--stl-bg) 94%, #000000) 100%);
  font-family: var(--stl-font);
  color: var(--stl-ink);
  -webkit-font-smoothing: antialiased;
}

.stl-block {
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  flex-direction: column;
  transform-origin: 0 0;
  white-space: nowrap;
}

.stl-heading {
  font-size: calc(var(--stl-heading) * 1cqmin);
  font-weight: 400;
  letter-spacing: -0.02em;
  line-height: 1.15;
  will-change: transform, opacity;
}

.stl-body {
  position: relative;
  margin-top: calc(var(--stl-step) * 0.25cqmin);
  padding: calc(var(--stl-step) * 0.2cqmin) 0 calc(var(--stl-step) * 1.2cqmin) calc(var(--stl-step) * 2.3cqmin);
}

.stl-line {
  position: absolute;
  left: calc(var(--stl-step) * 0.74cqmin);
  top: 0;
  bottom: 0;
  width: max(1px, 0.18cqmin);
  background: var(--stl-line);
  transform-origin: 50% 0;
  will-change: transform;
}

.stl-steps {
  display: flex;
  flex-direction: column;
  gap: calc(var(--stl-step) * 0.82cqmin);
  font-size: calc(var(--stl-step) * 1cqmin);
  letter-spacing: -0.01em;
  line-height: 1.02;
}

.stl-row {
  display: flex;
  align-items: flex-start;
  will-change: transform, opacity;
}

.stl-icon {
  flex: none;
  width: 1.04em;
  height: 1.04em;
  margin: -0.02em 0.3em 0 0;
}

.stl-icon svg {
  display: block;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
}

.stl-detail {
  color: var(--stl-muted);
  white-space: normal;
  text-align: right;
  max-width: 8.6em;
  margin-left: 0.3em;
}

.stl-working {
  font-size: calc(var(--stl-step) * 1cqmin);
  letter-spacing: -0.01em;
  line-height: 1;
  margin-top: calc(var(--stl-step) * 0.1cqmin);
}

.stl-working span {
  will-change: opacity;
}
`;
