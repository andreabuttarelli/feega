export const COMMENTS_CSS = String.raw`
.cg {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: var(--cg-bg);
}

.cg[data-theme='light'] {
  --cg-bg: #ecebe7;
  --cg-card: #ffffff;
  --cg-ink: #0b0b0c;
  --cg-title: #0a0a0a;
  --cg-line: rgba(0, 0, 0, 0.06);
  --cg-drop: 0, 0, 0;
}

.cg[data-theme='dark'] {
  --cg-bg: #0a0a0b;
  --cg-card: #161618;
  --cg-ink: #f2f2f3;
  --cg-title: #ffffff;
  --cg-line: rgba(255, 255, 255, 0.07);
  --cg-drop: 0, 0, 0;
}

.cg[data-theme='custom'] {
  --cg-bg: var(--cg-custom-bg);
  --cg-card: var(--cg-custom-card);
  --cg-ink: var(--cg-custom-ink);
  --cg-title: var(--cg-custom-title);
  --cg-line: color-mix(in srgb, var(--cg-custom-ink) 8%, transparent);
  --cg-drop: 0, 0, 0;
}

.cg-grid {
  position: absolute;
  inset: 0;
  will-change: filter;
}

.cg-measure {
  position: absolute;
  left: 0;
  top: 0;
  visibility: hidden;
}

.cg-card {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
  width: var(--cg-cw);
  padding: calc(var(--cg-cw) * 0.07);
  border-radius: calc(var(--cg-cw) * var(--cg-radius));
  background: var(--cg-card);
  box-shadow: 0 0 0 1px var(--cg-line), 0 calc(var(--cg-cw) * 0.03) calc(var(--cg-cw) * 0.09) rgba(var(--cg-drop), calc(var(--cg-shadow) * 0.16));
  color: var(--cg-ink);
  font-family: var(--cg-card-font);
  font-size: calc(var(--cg-cw) * 0.05);
  line-height: 1.42;
  -webkit-font-smoothing: antialiased;
  will-change: transform, opacity;
}

.cg-head {
  display: flex;
  align-items: center;
  gap: 0.6em;
}

.cg-avatar {
  flex: none;
  display: grid;
  place-items: center;
  width: 2.5em;
  height: 2.5em;
  overflow: hidden;
  border-radius: 50%;
  background: var(--cg-tint);
  color: #ffffff;
  font-size: 0.86em;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.cg-avatar img,
.cg-avatar video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cg-who {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.2;
}

.cg-name {
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cg-handle {
  color: color-mix(in srgb, var(--cg-ink) 52%, var(--cg-card));
  font-size: 0.86em;
  white-space: nowrap;
}

.cg-time {
  margin-left: auto;
  align-self: flex-start;
  color: color-mix(in srgb, var(--cg-ink) 45%, var(--cg-card));
  font-size: 0.82em;
}

.cg-stars {
  margin-top: 0.8em;
  color: var(--cg-accent);
  font-size: 0.86em;
  letter-spacing: 0.12em;
}

.cg-stars i {
  font-style: normal;
  color: color-mix(in srgb, var(--cg-ink) 14%, var(--cg-card));
}

.cg-text {
  margin: 0.55em 0 0;
  letter-spacing: -0.005em;
}

.cg-head + .cg-text {
  margin-top: 0.8em;
}

.cg-veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse 62% 58% at 50% 50%, color-mix(in srgb, var(--cg-bg) 94%, transparent), color-mix(in srgb, var(--cg-bg) 50%, transparent));
}

.cg-title {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
  pointer-events: none;
  font-family: var(--cg-font);
  -webkit-font-smoothing: antialiased;
}

.cg-headline {
  margin: 0;
  max-width: 86cqw;
  font-size: calc(var(--cg-size) * 1cqmin);
  font-weight: var(--cg-weight);
  letter-spacing: var(--cg-tracking);
  line-height: 0.95;
  color: var(--cg-title);
}

.cg-word {
  display: inline-block;
  white-space: pre;
  will-change: transform, opacity;
}
`;
