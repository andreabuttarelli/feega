export const PAPER_CSS = String.raw`
.pp {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: radial-gradient(90% 80% at 50% 38%, #f4f4f4 0%, var(--pp-bg) 62%, #c9c9c9 100%);
  font-family: var(--pp-font);
  -webkit-font-smoothing: antialiased;
}

.pp-stage {
  position: absolute;
  inset: 0;
}

.pp-card {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 50% 50%;
  filter: drop-shadow(0 calc(var(--pp-u) * 0.03) calc(var(--pp-u) * 0.03) rgba(0, 0, 0, 0.16));
  will-change: transform;
}

.pp-sheet {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.pp-back {
  inset: -4% 6% 10% -6%;
  background: #f6a623;
  transform: rotate(-7deg);
}

.pp-cutout {
  background: var(--pp-cutout);
}

.pp-panel {
  background: var(--pp-panel);
}

.pp-paper {
  background: var(--pp-paper);
}

.pp-cut {
  position: absolute;
  inset: 12% 14% 8% 16%;
}

.pp-photo {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pp-facets {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  filter: blur(calc(var(--pp-u) * 0.0022));
}

.pp-lines {
  position: absolute;
  inset: 8%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: var(--pp-number);
  font-weight: 400;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.pp-line {
  line-height: 1.12;
  white-space: nowrap;
  will-change: transform, opacity;
}

.pp-sketch {
  position: absolute;
  inset: 8%;
  width: 84%;
  height: 84%;
  overflow: visible;
}

.pp-sketch path {
  fill: none;
  stroke: var(--pp-ink);
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1 2;
}

.pp-labels {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  color: #ffffff;
  font-size: calc(var(--pp-u) * 0.016);
  letter-spacing: -0.01em;
}

.pp-brand {
  position: absolute;
  left: calc(var(--pp-u) * 0.04);
  top: calc(var(--pp-u) * 0.03);
  font-size: calc(var(--pp-u) * 0.042);
  font-weight: 500;
  letter-spacing: -0.05em;
}

.pp-left,
.pp-centre,
.pp-right {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.85;
}

.pp-left {
  left: calc(var(--pp-u) * 0.04);
}

.pp-centre {
  left: 50%;
  transform: translate(-50%, -50%);
}

.pp-right {
  right: calc(var(--pp-u) * 0.04);
}

.pp-mark {
  position: absolute;
  right: calc(var(--pp-u) * 0.04);
  top: calc(var(--pp-u) * 0.03);
  display: grid;
  place-items: center;
  width: calc(var(--pp-u) * 0.075);
  height: calc(var(--pp-u) * 0.075);
  border-radius: 50%;
  background: rgba(90, 90, 90, 0.85);
}

.pp-mark svg {
  width: 45%;
  height: 45%;
  fill: none;
  stroke: #ffffff;
  stroke-width: 2;
  stroke-linejoin: round;
}

.pp-badge {
  position: absolute;
  left: calc(var(--pp-u) * 0.03);
  bottom: calc(var(--pp-u) * 0.03);
  display: grid;
  place-items: center;
  width: calc(var(--pp-u) * 0.08);
  height: calc(var(--pp-u) * 0.08);
  border-radius: 50%;
  background: var(--pp-badge);
  font-style: normal;
  font-size: calc(var(--pp-u) * 0.022);
  font-weight: 500;
  letter-spacing: -0.03em;
}
`;
