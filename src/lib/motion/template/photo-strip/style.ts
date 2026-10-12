export const STRIP_CSS = String.raw`
.ps {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: var(--ps-bg);
}

.ps-row {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
}

.ps-over {
  z-index: 200;
}

.ps-card {
  position: absolute;
  left: 0;
  top: 0;
  overflow: hidden;
  background: var(--ps-empty);
  border-radius: var(--ps-radius);
  will-change: transform;
  box-shadow: 0 calc(var(--ps-lift) * 2.4cqmin) calc(var(--ps-lift) * 6cqmin) rgba(0, 0, 0, calc(0.55 * var(--ps-shadow) * var(--ps-lift)));
}

.ps-card img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.ps-caption {
  position: absolute;
  left: 0;
  top: 0;
  white-space: nowrap;
  pointer-events: none;
  font-family: var(--ps-font);
  font-size: calc(var(--ps-size) * 1cqmin);
  font-weight: var(--ps-weight);
  letter-spacing: var(--ps-tracking);
  color: var(--ps-ink);
  -webkit-font-smoothing: antialiased;
}

.ps-cursor {
  position: absolute;
  left: 0;
  top: 0;
  width: 3.2cqmin;
  height: 3.2cqmin;
  border-radius: 50%;
  background: var(--ps-cursor);
  opacity: 0;
  pointer-events: none;
  box-shadow: 0 0.4cqmin 1.6cqmin rgba(0, 0, 0, 0.35);
}
`;
