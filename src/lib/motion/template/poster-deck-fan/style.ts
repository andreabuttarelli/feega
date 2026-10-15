export const PD_CSS = String.raw`
.pd {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--pd-bg);
  font-family: var(--pd-font);
  -webkit-font-smoothing: antialiased;
}

.pd-deck {
  position: absolute;
  transform-style: preserve-3d;
}

.pd-card {
  position: absolute;
  transform-style: preserve-3d;
  transform-origin: 0 100%;
  will-change: transform;
}

.pd-sheet {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  transform-origin: 50% 100%;
  will-change: transform;
}

.pd-face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  backface-visibility: hidden;
  box-shadow: 0 0 0 0.002em rgba(0, 0, 0, 0.18);
}

.pd-face-a {
  background: var(--pd-face-a);
}

.pd-face-b {
  background: var(--pd-face-b);
  transform: rotateY(180deg);
}

.pd-face-a,
.pd-face-b {
  color: var(--pd-ink);
}

.pd-small {
  position: absolute;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 0.05em;
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1;
  white-space: nowrap;
}

.pd-head {
  top: 8%;
}

.pd-foot {
  bottom: 8%;
}

.pd-title {
  position: absolute;
  inset: 18% 6%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-size: 0.3em;
  font-weight: var(--pd-weight);
  letter-spacing: var(--pd-tracking);
  line-height: 0.8;
}

.pd-title-line {
  white-space: nowrap;
}

.pd-ring {
  position: absolute;
  border-radius: 50%;
  border: 0.006em solid var(--pd-ink);
}

.pd-photo {
  background: var(--pd-empty);
}

.pd-photo img,
.pd-photo video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pd-paper {
  background: var(--pd-paper);
}

.pd-dark {
  background: var(--pd-dark);
}

.pd-accent {
  background: var(--pd-accent);
}
`;
