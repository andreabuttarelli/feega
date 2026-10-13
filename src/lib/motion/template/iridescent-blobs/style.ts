export const BLOBS_CSS = String.raw`
.ib {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: var(--ib-bg);
}

.ib-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.ib-title {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
  pointer-events: none;
  font-family: var(--ib-font);
  -webkit-font-smoothing: antialiased;
}

.ib-headline {
  margin: 0;
  max-width: 86cqw;
  font-size: calc(var(--ib-size) * 1cqmin);
  font-weight: var(--ib-weight);
  letter-spacing: var(--ib-tracking);
  line-height: 0.95;
  color: var(--ib-ink);
}

.ib-word {
  display: inline-block;
  white-space: pre;
  will-change: transform, opacity;
}
`;
