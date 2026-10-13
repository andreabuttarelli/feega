export const RIBBON_CSS = String.raw`
.pr {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: var(--pr-bg);
}

.pr-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.pr-veil {
  position: absolute;
  inset: 0;
  background: var(--pr-bg);
  pointer-events: none;
}

.pr-title {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
  pointer-events: none;
  font-family: var(--pr-font);
  -webkit-font-smoothing: antialiased;
}

.pr-headline {
  margin: 0;
  max-width: 86cqw;
  font-size: calc(var(--pr-size) * 1cqmin);
  font-weight: var(--pr-weight);
  letter-spacing: var(--pr-tracking);
  line-height: 0.95;
  color: var(--pr-ink);
}

.pr-word {
  display: inline-block;
  white-space: pre;
  will-change: transform, opacity;
}
`;
