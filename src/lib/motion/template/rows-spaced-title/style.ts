export const ROWS_CSS = String.raw`
.rst {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: var(--rst-bg);
}

.rst-row {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
}

.rst-card {
  position: absolute;
  left: 0;
  top: 0;
  overflow: hidden;
  background: var(--rst-empty);
  border-radius: var(--rst-radius);
  will-change: transform;
}

.rst-card img,
.rst-card video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.rst-title {
  position: absolute;
  left: 50%;
  top: 50%;
  display: flex;
  align-items: baseline;
  white-space: nowrap;
  pointer-events: none;
  font-family: var(--rst-font);
  font-size: calc(var(--rst-size) * 1cqmin);
  font-weight: var(--rst-weight);
  letter-spacing: var(--rst-tracking);
  line-height: 1.2;
  color: var(--rst-ink);
  -webkit-font-smoothing: antialiased;
}

.rst-word {
  display: inline-block;
  will-change: transform, opacity;
}
`;
