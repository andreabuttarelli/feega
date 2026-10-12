export const RING_CSS = String.raw`
.rt {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: var(--rt-bg);
}

.rt-card {
  position: absolute;
  left: 50%;
  top: 50%;
  overflow: hidden;
  background: var(--rt-empty);
  will-change: transform, opacity;
}

.rt-card img,
.rt-card video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.rt-shade {
  position: absolute;
  inset: 0;
  background: var(--rt-bg);
  pointer-events: none;
}

.rt-title {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
  pointer-events: none;
  font-family: var(--rt-font);
  -webkit-font-smoothing: antialiased;
}

.rt-headline {
  margin: 0;
  white-space: nowrap;
  font-weight: var(--rt-weight);
  letter-spacing: var(--rt-tracking);
  line-height: 1;
  color: var(--rt-ink);
}

.rt-word {
  display: inline-block;
  white-space: pre;
  will-change: transform, opacity;
}
`;
