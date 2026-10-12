export const MARQUEE_CSS = String.raw`
.mq {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: var(--mq-bg);
  color: var(--mq-ink);
  font-family: var(--mq-font);
  -webkit-font-smoothing: antialiased;
  user-select: none;
  -webkit-user-select: none;
}

.mq-rows {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--mq-row-gap);
  -webkit-mask-image: var(--mq-mask);
  mask-image: var(--mq-mask);
}

.mq-x .mq-rows {
  flex-direction: column;
}

.mq-row {
  position: relative;
  flex: none;
  touch-action: none;
}

.mq-x .mq-row {
  width: 100%;
}

.mq-y .mq-row {
  height: 100%;
}

.mq-drag .mq-row {
  cursor: grab;
}

.mq-drag .mq-row.mq-held {
  cursor: grabbing;
}

.mq-track {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
  backface-visibility: hidden;
}

.mq-cell {
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.mq-cell img {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.mq-logo {
  opacity: var(--mq-logo-opacity);
}

.mq-logo img {
  object-fit: contain;
}

.mq-mono {
  width: 100%;
  height: 100%;
  background: var(--mq-ink);
  -webkit-mask: var(--mq-src) center / contain no-repeat;
  mask: var(--mq-src) center / contain no-repeat;
}

.mq-word {
  display: flex;
  align-items: center;
  gap: 0.32em;
  white-space: nowrap;
  font-size: calc(var(--mq-size) * 0.5);
  line-height: 1;
}

.mq-word svg {
  width: 0.9em;
  height: 0.9em;
  flex: none;
  fill: currentColor;
}

.mq-image {
  background: var(--mq-card);
}

.mq-image img {
  object-fit: cover;
}

.mq-quote {
  flex-direction: column;
  align-items: stretch;
  justify-content: space-between;
  box-sizing: border-box;
  padding: 2.4cqmin 2.6cqmin;
  background: var(--mq-card);
  text-align: left;
}

.mq-said {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: calc(var(--mq-quote) * 1cqmin);
  font-weight: var(--mq-weight);
  letter-spacing: var(--mq-tracking);
  line-height: 1.22;
}

.mq-who {
  display: flex;
  align-items: center;
  gap: 1.1cqmin;
  font-size: calc(var(--mq-quote) * 0.62cqmin);
  opacity: 0.62;
  white-space: nowrap;
}

.mq-who i {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.2em;
  height: 2.2em;
  flex: none;
  border-radius: 50%;
  background: var(--mq-ink);
  color: var(--mq-card);
  font-style: normal;
  font-weight: 600;
  font-size: 0.9em;
}
`;
