export const SCROLL_CSS = String.raw`
.fs {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: var(--fs-bg);
  font-family: var(--fs-font);
  -webkit-font-smoothing: antialiased;
}

.fs-probe {
  position: absolute;
  visibility: hidden;
  white-space: pre;
  line-height: 1;
}

.fs-filter {
  position: absolute;
  width: 0;
  height: 0;
}

.fs-view {
  position: absolute;
  inset: 0;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 var(--fs-fade), #000 calc(100% - var(--fs-fade)), transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0, #000 var(--fs-fade), #000 calc(100% - var(--fs-fade)), transparent 100%);
}

.fs-column {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 0;
  will-change: transform, filter;
}

.fs-text {
  position: absolute;
  left: 50%;
  margin: 0;
  white-space: nowrap;
  line-height: 1;
  font-size: calc(var(--fs-size) * 1cqmin);
  font-weight: var(--fs-weight);
  letter-spacing: var(--fs-tracking);
  color: var(--fs-ink);
  transform: translate(-50%, -50%);
  will-change: transform, opacity;
}

.fs-title {
  text-align: center;
}

.fs-word {
  display: inline-block;
  white-space: pre;
  will-change: transform, opacity;
}

.fs-line {
  display: flex;
  align-items: center;
  gap: 0.45em;
  width: var(--fs-width);
}

.fs[data-align='center'] .fs-line {
  justify-content: center;
}

.fs-dot {
  display: none;
  flex: none;
  width: 0.24em;
  height: 0.24em;
  border-radius: 50%;
  background: var(--fs-mark);
}

.fs[data-marker='dot'] .fs-dot {
  display: block;
}

.fs[data-marker='rule'] .fs-line::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(-1 * var(--fs-rule-drop));
  height: max(1px, 0.02em);
  background: var(--fs-mark);
}
`;
