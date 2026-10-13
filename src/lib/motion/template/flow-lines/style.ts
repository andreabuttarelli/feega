export const FLOW_CSS = String.raw`
.fl {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
}

.fl-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.fl-title {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
  pointer-events: none;
  font-family: var(--fl-font);
  -webkit-font-smoothing: antialiased;
}

.fl-headline {
  margin: 0;
  max-width: 86cqw;
  font-size: calc(var(--fl-size) * 1cqmin);
  font-weight: var(--fl-weight);
  letter-spacing: var(--fl-tracking);
  line-height: 0.95;
  color: var(--fl-ink);
}

.fl-word {
  display: inline-block;
  white-space: pre;
  will-change: transform, opacity;
}
`;
