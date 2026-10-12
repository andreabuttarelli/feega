export const GRID_CSS = String.raw`
.gw {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background-color: var(--gw-bg);
  background-image: linear-gradient(to right, var(--gw-line) var(--gw-stroke), transparent var(--gw-stroke)), linear-gradient(to bottom, var(--gw-line) var(--gw-stroke), transparent var(--gw-stroke));
}

.gw-chip {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gw-chip);
  will-change: clip-path, opacity;
}

.gw-word {
  white-space: nowrap;
  pointer-events: none;
  font-family: var(--gw-font);
  font-weight: var(--gw-weight);
  letter-spacing: var(--gw-tracking);
  line-height: 1;
  color: var(--gw-ink);
  will-change: transform, opacity;
  -webkit-font-smoothing: antialiased;
}

.gw-media {
  position: absolute;
  overflow: hidden;
  background: var(--gw-empty);
  will-change: clip-path, opacity;
}

.gw-media img,
.gw-media video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}
`;
