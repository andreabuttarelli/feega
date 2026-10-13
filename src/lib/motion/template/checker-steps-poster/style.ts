export const CHECKER_CSS = String.raw`
.cs {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--cs-paper);
  color: var(--cs-ink);
  font-family: var(--cs-font);
  -webkit-font-smoothing: antialiased;
}

.cs-cell {
  position: absolute;
  background: var(--cs-checker);
}

.cs-cell::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: var(--cs-wear-image);
  background-size: 160%, 120%;
  background-position: var(--cs-at);
  opacity: var(--cs-wear);
}

.cs-step {
  position: absolute;
  white-space: pre;
  line-height: 1;
  font-weight: var(--cs-weight);
  letter-spacing: var(--cs-tracking);
}

.cs-bar {
  position: absolute;
  background: var(--cs-checker);
}

.cs-index {
  position: absolute;
  padding-top: 0.5em;
  border-top: 0 solid var(--cs-ink);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: pre;
}

.cs-marker {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--cs-ink);
  color: var(--cs-paper);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.cs-body {
  position: absolute;
  margin: 0;
  font-weight: 600;
  line-height: 1.28;
  letter-spacing: -0.025em;
}
`;
