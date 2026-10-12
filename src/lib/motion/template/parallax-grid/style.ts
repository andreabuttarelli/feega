export const PGRID_CSS = String.raw`
.pg {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: var(--pg-bg);
}

.pg-grid {
  position: absolute;
  inset: 0;
  transform-origin: 50% 50%;
}

.pg-tile {
  position: absolute;
  left: 0;
  top: 0;
  overflow: hidden;
  background: var(--pg-empty);
  will-change: transform;
  backface-visibility: hidden;
}

.pg-tile img,
.pg-tile video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pg-veil {
  position: absolute;
  inset: 0;
  background: var(--pg-bg);
  pointer-events: none;
}

.pg-title {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
  pointer-events: none;
  font-family: var(--pg-font);
  -webkit-font-smoothing: antialiased;
}

.pg-headline {
  margin: 0;
  max-width: 86cqw;
  font-size: calc(var(--pg-size) * 1cqmin);
  font-weight: var(--pg-weight);
  letter-spacing: var(--pg-tracking);
  line-height: 0.95;
  color: var(--pg-ink);
}

.pg-word {
  display: inline-block;
  white-space: pre;
  will-change: transform, opacity;
}
`;
