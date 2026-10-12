export const STORY_CSS = String.raw`
.ss {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: var(--ss-bg);
  color: var(--ss-ink);
  font-family: var(--ss-font);
  -webkit-font-smoothing: antialiased;
}

.ss-grid,
.ss-images,
.ss-text {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ss-v,
.ss-h {
  position: absolute;
  display: block;
  background: var(--ss-line);
  opacity: var(--ss-line-opacity);
}

.ss-v {
  width: var(--ss-hair);
  margin-left: calc(var(--ss-hair) / -2);
  transform-origin: 50% 0;
}

.ss-h {
  height: var(--ss-hair);
  margin-top: calc(var(--ss-hair) / -2);
  transform-origin: 0 50%;
}

.ss-fig {
  position: absolute;
  left: 0;
  top: 0;
  margin: 0;
  will-change: transform;
}

.ss-pic {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: color-mix(in srgb, var(--ss-ink) 8%, var(--ss-bg));
}

.ss-pic img {
  position: absolute;
  left: 0;
  top: -20%;
  display: block;
  width: 100%;
  height: 140%;
  object-fit: cover;
}

.ss-cap {
  position: absolute;
  left: 0;
  bottom: 100%;
  padding-bottom: 0.8cqmin;
  font-size: 1.5cqmin;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  color: var(--ss-label);
}

.ss-head {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: calc(var(--ss-size) * 1cqmin);
  font-weight: var(--ss-weight);
  letter-spacing: var(--ss-tracking);
  line-height: 0.98;
}

.ss-line {
  display: block;
  overflow: hidden;
  padding: 0.04em 0.06em 0.08em;
  margin: -0.04em 0 -0.08em;
  white-space: pre;
}

.ss-in {
  display: block;
  will-change: transform;
}

.ss-kicker,
.ss-index,
.ss-progress {
  position: absolute;
  font-size: 1.6cqmin;
  font-weight: 500;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--ss-label);
}

.ss-kicker .ss-line,
.ss-index-now .ss-line {
  position: absolute;
  left: 0;
  top: 0;
}

.ss-kicker .ss-line {
  color: var(--ss-ink);
}

.ss-index {
  display: flex;
}

.ss-index-now {
  position: relative;
  display: inline-block;
  width: 1.3em;
  height: 1.2em;
  color: var(--ss-ink);
}

.ss-progress {
  height: 0;
}

.ss-bar {
  position: absolute;
  left: 0;
  top: calc(var(--ss-hair) * -1);
  display: block;
  width: 100%;
  height: calc(var(--ss-hair) * 2);
  background: var(--ss-ink);
  transform-origin: 0 50%;
}

.ss-mark {
  position: absolute;
  bottom: 0;
  padding: 0 0 1cqmin 0.8cqmin;
  color: var(--ss-ink);
}

.ss-bare .ss-kicker,
.ss-bare .ss-index,
.ss-bare .ss-progress,
.ss-bare .ss-cap {
  display: none;
}
`;
