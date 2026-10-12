export const COLLAGE_CSS = String.raw`
.cs {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: var(--cs-bg);
}

.cs-letters {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
}

.cs-strip {
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  white-space: pre;
  font-family: var(--cs-font);
  font-size: calc(var(--cs-size) * 1cqmin);
  font-weight: 900;
  font-style: italic;
  letter-spacing: -0.04em;
  line-height: 0.8;
  color: var(--cs-fill);
  -webkit-text-stroke: var(--cs-stroke) var(--cs-letter);
  will-change: transform;
}

.cs-world {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
}

.cs-card {
  position: absolute;
  left: 0;
  top: 0;
  overflow: hidden;
  background: var(--cs-empty);
  box-shadow: 0 0.4cqmin 2.4cqmin rgba(0, 0, 0, 0.28);
  will-change: transform;
}

.cs-card.cs-print {
  background: var(--cs-paper);
  padding: 7%;
  box-sizing: border-box;
}

.cs-card img,
.cs-card video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cs-print img,
.cs-print video {
  filter: grayscale(1) contrast(1.08);
}

.cs-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.cs-line {
  position: absolute;
  left: 0.7%;
  right: 0.7%;
  height: 1px;
  background: var(--cs-label);
  opacity: 0.32;
  transform-origin: 0 50%;
  will-change: transform;
}

.cs-cell {
  position: absolute;
  margin: 0;
  font-family: "JetBrains Mono", "IBM Plex Mono", ui-monospace, Menlo, monospace;
  font-size: 1.15cqmin;
  line-height: 1.45;
  letter-spacing: 0.02em;
  color: var(--cs-label);
  text-shadow: 0 0 0.25cqmin rgba(0, 0, 0, 0.55);
  white-space: pre;
  will-change: transform, opacity;
}
`;
