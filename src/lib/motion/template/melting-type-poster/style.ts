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
  color: var(--mt-ink);
  font-family: var(--mt-font);
  font-weight: 500;
  -webkit-font-smoothing: antialiased;
}

.mt-page p,
.mt-page h1,
.mt-page h2 {
  position: absolute;
  margin: 0;
  white-space: pre-line;
}

.mt-melts {
  color: transparent;
  white-space: pre;
}

.mt-line {
  display: block;
}

.mt-kicker {
  left: 21.5cqw;
  top: 5.2cqh;
  font-size: 1.5cqw;
  line-height: 1.25;
  letter-spacing: -0.02em;
}

.mt-index,
.mt-title,
.mt-sub {
  font-size: 6.6cqw;
  font-weight: 500;
  line-height: 1.08;
  letter-spacing: -0.035em;
}

.mt-index {
  left: 6.4cqw;
  top: 19.4cqh;
}

.mt-title {
  left: 21.5cqw;
  top: 19.4cqh;
}

.mt-sub {
  left: 21.5cqw;
  top: 34.6cqh;
}

.mt-col {
  top: 50.6cqh;
  width: 27.6cqw;
  font-size: 1.62cqw;
  line-height: 1.17;
  letter-spacing: -0.025em;
}

.mt-left {
  left: 21.5cqw;
}

.mt-right {
  left: 51.4cqw;
}

.mt-foot {
  left: 6.4cqw;
  bottom: 4.6cqh;
  font-size: 1.15cqw;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.mt-credit {
  right: 2.6cqw;
  top: 20cqh;
  font-size: 1.1cqw;
  writing-mode: vertical-rl;
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
