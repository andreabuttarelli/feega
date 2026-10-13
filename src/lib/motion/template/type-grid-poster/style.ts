export const TYPE_GRID_CSS = String.raw`
.tg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--tg-paper);
  color: var(--tg-ink);
  font-family: var(--tg-font);
  font-weight: var(--tg-weight);
  -webkit-font-smoothing: antialiased;
}

.tg-stack {
  position: absolute;
  left: var(--tg-margin);
  right: var(--tg-margin);
  top: var(--tg-margin);
  font-size: var(--tg-px);
  line-height: var(--tg-leading);
  letter-spacing: var(--tg-tracking);
  display: flex;
  flex-direction: column;
  gap: var(--tg-spread);
}

.tg-line {
  display: flex;
  align-items: center;
  gap: 0.12em;
  height: calc(var(--tg-leading) * 1em);
  white-space: pre;
}

.tg-word {
  flex: none;
}

.tg-photo {
  position: relative;
  flex: 1 1 0;
  align-self: center;
  height: 0.8em;
  min-width: 1em;
  overflow: hidden;
  background: var(--tg-tint);
  mix-blend-mode: multiply;
}

.tg-photo img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(1) contrast(1.35) brightness(1.15);
}

.tg-photo::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: var(--tg-noise);
  background-size: 0.9em;
  opacity: var(--tg-grain);
}

.tg-shape-0 {
  background:
    repeating-linear-gradient(62deg, rgb(255 255 255 / 0.55) 0 0.05em, transparent 0.05em 0.16em),
    repeating-linear-gradient(-62deg, rgb(0 0 0 / 0.35) 0 0.04em, transparent 0.04em 0.16em),
    linear-gradient(170deg, #f2f2f2 0 38%, #8a8a8a 38% 100%);
}

.tg-shape-1 {
  background:
    radial-gradient(ellipse 0.42em 0.5em at 0.32em 0.62em, #3a3a3a 98%, transparent 100%),
    radial-gradient(ellipse 0.42em 0.5em at 1.34em 0.62em, #3a3a3a 98%, transparent 100%),
    repeating-linear-gradient(90deg, #d8d8d8 0 0.8em, #f6f6f6 0.8em 1.02em),
    #e8e8e8;
}

.tg-shape-2 {
  background:
    repeating-linear-gradient(90deg, #1c1c1c 0 0.06em, #bdbdbd 0.06em 0.22em, #5a5a5a 0.22em 0.3em),
    repeating-linear-gradient(0deg, rgb(255 255 255 / 0.4) 0 0.04em, transparent 0.04em 0.24em),
    #6d6d6d;
  background-blend-mode: multiply, normal, normal;
}

.tg-arrow {
  flex: none;
  width: 1.05em;
  height: 0.62em;
  margin-left: auto;
}

.tg-foot {
  position: absolute;
  left: var(--tg-margin);
  right: var(--tg-margin);
  bottom: var(--tg-margin);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  font-size: var(--tg-foot);
  line-height: 1.15;
  letter-spacing: -0.01em;
  white-space: pre;
}

.tg-foot div:last-child {
  text-align: right;
}

.tg-probe {
  position: absolute;
  visibility: hidden;
  white-space: pre;
  font-size: 100px;
  letter-spacing: var(--tg-tracking);
}
`;
