export const SPLIT_CSS = String.raw`
.sh {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--sh-bg);
  font-family: var(--sh-font);
  font-size: var(--sh-px);
  -webkit-font-smoothing: antialiased;
}

.sh-half {
  position: absolute;
  left: 50%;
  top: 50%;
  margin: 0;
  white-space: nowrap;
  line-height: 1;
  font-weight: var(--sh-weight);
  letter-spacing: var(--sh-tracking);
  color: var(--sh-ink);
  will-change: transform;
}

.sh-word {
  display: inline-block;
  white-space: pre;
  will-change: transform, opacity;
}

.sh-probe {
  position: absolute;
  visibility: hidden;
  white-space: pre;
}

.sh-media {
  position: absolute;
  left: 50%;
  top: 50%;
  overflow: hidden;
  background: var(--sh-empty);
}

.sh[data-mask='pill'] .sh-media {
  border-radius: 9999px;
}

.sh-media img,
.sh-media video {
  position: absolute;
  left: 50%;
  top: 50%;
  display: block;
  object-fit: cover;
  will-change: transform;
}
`;
