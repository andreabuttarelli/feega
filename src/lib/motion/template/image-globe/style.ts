export const GLOBE_CSS = String.raw`
.ig {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: var(--ig-bg);
}

.ig-globe {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
}

.ig-tile {
  position: absolute;
  left: 0;
  top: 0;
  overflow: hidden;
  background: var(--ig-empty);
  will-change: transform, opacity;
}

.ig-tile img,
.ig-tile video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ig-shade,
.ig-veil {
  position: absolute;
  inset: 0;
  background: var(--ig-bg);
  pointer-events: none;
}

.ig-title {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
  pointer-events: none;
  font-family: var(--ig-font);
  -webkit-font-smoothing: antialiased;
}

.ig-headline {
  margin: 0;
  max-width: 86cqw;
  font-size: calc(var(--ig-size) * 1cqmin);
  font-weight: var(--ig-weight);
  letter-spacing: var(--ig-tracking);
  line-height: 0.95;
  color: var(--ig-ink);
}

.ig-word {
  display: inline-block;
  white-space: pre;
  will-change: transform, opacity;
}
`;
