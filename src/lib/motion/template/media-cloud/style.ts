export const CLOUD_CSS = String.raw`
.mc {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: var(--mc-bg);
}

.mc-world {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.mc-tile {
  position: absolute;
  left: 50%;
  top: 50%;
  overflow: hidden;
  background: var(--mc-empty);
}

.mc-tile img,
.mc-tile video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mc-title {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  pointer-events: none;
  font-family: var(--mc-font);
  -webkit-font-smoothing: antialiased;
}

.mc-headline {
  margin: 0;
  max-width: 86cqw;
  text-align: center;
  font-size: calc(var(--mc-size) * 1cqmin);
  font-weight: var(--mc-weight);
  letter-spacing: var(--mc-tracking);
  line-height: 0.95;
  color: var(--mc-ink);
}

.mc-word {
  display: inline-block;
  white-space: pre;
  will-change: transform, opacity;
}
`;
