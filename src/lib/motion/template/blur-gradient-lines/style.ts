export const BLUR_LINES_CSS = String.raw`
.bgl {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: linear-gradient(180deg, var(--bgl-top), var(--bgl-bottom));
}

.bgl-shape {
  position: absolute;
  left: 50%;
  top: 50%;
  overflow: hidden;
  border-radius: 9999px;
  background: radial-gradient(closest-side, var(--bgl-shape), transparent);
  will-change: transform, filter;
}

.bgl-shape.has-media {
  border-radius: 0;
  background: none;
}

.bgl-shape img,
.bgl-shape video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.82;
  filter: brightness(1.45) saturate(1.15);
}

.bgl-line {
  position: absolute;
  left: 0;
  width: 100%;
  height: 1px;
  background: var(--bgl-line);
  transform-origin: 50% 50%;
  will-change: transform;
}

.bgl-text {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  pointer-events: none;
  font-family: var(--bgl-font);
  -webkit-font-smoothing: antialiased;
}

.bgl-headline {
  margin: 0;
  white-space: pre;
  font-weight: var(--bgl-weight);
  letter-spacing: var(--bgl-tracking);
  line-height: 1.1;
  color: var(--bgl-ink);
  will-change: transform, opacity;
}

.bgl-letter {
  display: inline-block;
  white-space: pre;
  will-change: opacity;
}
`;
