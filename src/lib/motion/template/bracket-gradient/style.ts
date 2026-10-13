export const BRACKET_CSS = String.raw`
.bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--bg-base);
  font-family: var(--bg-font);
  font-size: var(--bg-px);
  -webkit-font-smoothing: antialiased;
}

.bg-mesh {
  position: absolute;
  inset: 0;
}

.bg-text {
  position: absolute;
  left: 50%;
  top: 50%;
  margin: 0;
  transform: translate(-50%, -50%);
  text-align: center;
  line-height: 1.2;
  font-weight: var(--bg-weight);
  letter-spacing: var(--bg-tracking);
  color: var(--bg-ink);
}

.bg-word {
  display: inline-block;
  white-space: pre;
  will-change: transform, opacity;
}

.bg-mark {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--bg-mark);
  height: var(--bg-mark);
  background: var(--bg-mark-ink);
  will-change: transform, opacity;
}
`;
