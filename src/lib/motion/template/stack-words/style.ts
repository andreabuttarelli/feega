export const STACK_CSS = String.raw`
.sw {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--sw-bg);
}

.sw-word {
  position: absolute;
  white-space: nowrap;
  pointer-events: none;
  font-family: var(--sw-font);
  font-weight: var(--sw-weight);
  letter-spacing: var(--sw-tracking);
  line-height: 1.1;
  color: var(--sw-ink);
  will-change: transform, opacity;
  -webkit-font-smoothing: antialiased;
}

.sw-card {
  position: absolute;
  left: 0;
  top: 0;
  overflow: hidden;
  background: var(--sw-empty);
  transform-origin: 0 0;
  will-change: transform;
}

.sw-card img,
.sw-card video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}
`;
