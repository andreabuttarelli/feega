export const EDITORIAL_CSS = String.raw`
.ew {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--ew-bg);
}

.ew-text {
  position: absolute;
  white-space: nowrap;
  pointer-events: none;
  font-family: var(--ew-font);
  font-weight: var(--ew-weight);
  letter-spacing: var(--ew-tracking);
  line-height: 1.02;
  color: var(--ew-ink);
  will-change: transform, opacity;
  -webkit-font-smoothing: antialiased;
}

.ew-media {
  position: absolute;
  overflow: hidden;
  background: var(--ew-empty);
  will-change: clip-path;
}

.ew-media img,
.ew-media video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}
`;
