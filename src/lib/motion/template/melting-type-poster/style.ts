export const MELT_CSS = String.raw`
.mt {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--mt-surround);
}

.mt-page {
  position: absolute;
  overflow: hidden;
  container-type: size;
  background: var(--mt-page);
  font-family: var(--mt-font);
  font-weight: 500;
  -webkit-font-smoothing: antialiased;
}

.mt-text {
  position: absolute;
  margin: 0;
  color: transparent;
}

.mt-kicker,
.mt-credit {
  top: 4.4cqh;
  font-size: 1.35cqw;
  letter-spacing: -0.01em;
}

.mt-kicker {
  left: 6cqw;
}

.mt-credit {
  right: 6cqw;
  text-align: right;
}

.mt-title {
  left: 5.4cqw;
  top: 9.5cqh;
  width: 70cqw;
  font-size: 12.4cqw;
  font-weight: 600;
  line-height: 0.9;
  letter-spacing: -0.055em;
}

.mt-index {
  right: 6cqw;
  top: 9.5cqh;
  font-size: 12.4cqw;
  font-weight: 300;
  line-height: 0.9;
  letter-spacing: -0.05em;
}

.mt-sub {
  left: 36cqw;
  top: 47cqh;
  width: 58cqw;
  font-size: 2.7cqw;
  line-height: 1.14;
  letter-spacing: -0.03em;
}

.mt-left,
.mt-mid,
.mt-right {
  top: 63cqh;
  width: 26cqw;
  font-size: 1.42cqw;
  line-height: 1.24;
  letter-spacing: -0.015em;
}

.mt-left {
  left: 6cqw;
}

.mt-mid {
  left: 37cqw;
}

.mt-right {
  left: 68cqw;
}

.mt-foot {
  left: 6cqw;
  top: 47.4cqh;
  width: 24cqw;
  font-size: 1.2cqw;
  letter-spacing: -0.01em;
}

.mt-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
`;
