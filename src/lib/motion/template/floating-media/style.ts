export const FLOAT_CSS = String.raw`
.fm {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: var(--fm-bg);
}

.fm-world {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
}

.fm-card {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
  overflow: hidden;
  background: var(--fm-empty);
  border: var(--fm-border) solid var(--fm-border-color);
  border-radius: var(--fm-radius);
  backface-visibility: hidden;
  will-change: transform, filter, opacity;
  box-shadow:
    0 0.6cqmin 1.4cqmin rgba(0, 0, 0, calc(0.18 * var(--fm-shadow))),
    0 3cqmin 7cqmin -1cqmin rgba(0, 0, 0, calc(0.45 * var(--fm-shadow)));
}

.fm-card img,
.fm-card video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fm-shade {
  position: absolute;
  inset: 0;
  background: var(--fm-bg);
  pointer-events: none;
}

.fm-title {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  text-align: center;
  pointer-events: none;
  font-family: var(--fm-font);
  -webkit-font-smoothing: antialiased;
}

.fm-headline {
  margin: 0;
  max-width: 86cqw;
  font-size: calc(var(--fm-size) * 1cqmin);
  font-weight: var(--fm-weight);
  letter-spacing: var(--fm-tracking);
  line-height: 0.95;
  color: var(--fm-ink);
}

.fm-word {
  display: inline-block;
  white-space: pre;
  will-change: transform, opacity;
}

.fm-sub {
  margin-top: 1.4cqmin;
  font-size: calc(var(--fm-size) * 0.2cqmin);
  font-weight: 450;
  letter-spacing: -0.01em;
  color: var(--fm-sub);
}
`;
