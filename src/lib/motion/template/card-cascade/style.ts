export const CC_CSS = String.raw`
.cc {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--cc-bg);
  font-family: var(--cc-font);
  -webkit-font-smoothing: antialiased;
}

.cc-stack {
  position: absolute;
}

.cc-card {
  position: absolute;
  overflow: hidden;
  border-radius: var(--cc-radius);
  background: var(--cc-empty);
  box-shadow: 0 0.02em 0.06em rgba(0, 0, 0, 0.12);
  will-change: transform, opacity;
}

.cc-card img,
.cc-card video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cc-type {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 0.06em;
  background: var(--cc-type);
  color: var(--cc-ink);
  font-weight: var(--cc-weight);
  line-height: 0.9;
  text-transform: uppercase;
  white-space: nowrap;
  text-align: center;
}

.cc-line {
  font-size: 0.2em;
  letter-spacing: var(--cc-tracking);
}

.cc-list {
  background: var(--cc-list);
  color: #fff;
}

.cc-track {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  padding: 0 0.04em;
  font-size: 0.135em;
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 1;
  will-change: transform;
}

.cc-word {
  white-space: nowrap;
}

.cc-letter {
  background: var(--cc-letter);
  color: #fff;
}

.cc-glyph {
  position: absolute;
  left: 0.04em;
  bottom: -0.18em;
  font-size: 1.05em;
  font-weight: 700;
  letter-spacing: -0.06em;
  line-height: 1;
}

.cc-colour {
  background: var(--cc-tag);
  color: #fff;
}

.cc-tag {
  position: absolute;
  left: 0.07em;
  bottom: 0.07em;
  font-size: 0.07em;
  font-weight: 500;
  letter-spacing: -0.02em;
}
`;
