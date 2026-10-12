export const SCATTER_CSS = String.raw`
.st {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: var(--st-bg);
}

.st-world {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
}

.st-card {
  position: absolute;
  left: 0;
  top: 0;
  overflow: hidden;
  background: var(--st-empty);
  will-change: transform, opacity;
}

.st-card img,
.st-card video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.st-title {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
  pointer-events: none;
  font-family: var(--st-font);
  -webkit-font-smoothing: antialiased;
}

.st-headline {
  margin: 0;
  max-width: 84cqw;
  font-size: calc(var(--st-size) * 1cqmin);
  font-weight: var(--st-weight);
  letter-spacing: var(--st-tracking);
  line-height: 1;
  color: var(--st-ink);
}

.st-word {
  display: inline-block;
  white-space: pre;
  will-change: transform, opacity;
}
`;
