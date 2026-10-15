export const FR_CSS = String.raw`
.fr {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--fr-bg);
}

.fr-back {
  position: absolute;
  inset: -3%;
  overflow: hidden;
  z-index: 0;
}

.fr-window {
  position: absolute;
  overflow: hidden;
  z-index: 1;
  box-shadow: 0 2.4em 5em rgba(0, 0, 0, 0.45);
  will-change: transform;
}

.fr-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  will-change: transform;
}

.fr-inner {
  position: absolute;
  inset: 0;
  will-change: transform;
}

.fr-mono .fr-inner {
  background: var(--fr-back-empty);
}

.fr-colour .fr-inner {
  background: var(--fr-front-empty);
}

.fr-inner img,
.fr-inner video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fr-mono img,
.fr-mono video {
  filter: var(--fr-mono);
}

.fr-meta {
  position: absolute;
  left: 4%;
  right: 4%;
  bottom: 3.2%;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  font-family: var(--fr-font);
  font-weight: var(--fr-weight);
  letter-spacing: var(--fr-tracking);
  font-size: var(--fr-size);
  line-height: 1;
  color: var(--fr-ink);
  -webkit-font-smoothing: antialiased;
}

.fr-count {
  font-variant-numeric: tabular-nums;
}
`;
