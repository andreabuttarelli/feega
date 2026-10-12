export const PHONE_CSS = String.raw`
.ps {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--ps-bg);
  font-family: var(--ps-font);
  font-size: var(--ps-px);
  perspective: 40em;
  -webkit-font-smoothing: antialiased;
}

.ps-half {
  position: absolute;
  left: 50%;
  top: 50%;
  margin: 0;
  white-space: nowrap;
  line-height: 1;
  font-weight: var(--ps-weight);
  letter-spacing: var(--ps-tracking);
  color: var(--ps-ink);
  will-change: transform;
}

.ps-word {
  display: inline-block;
  white-space: pre;
  will-change: transform, opacity;
}

.ps-probe {
  position: absolute;
  visibility: hidden;
  white-space: pre;
}

.ps-phone {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--ps-w);
  height: var(--ps-h);
  transform-style: preserve-3d;
  will-change: transform;
}

.ps-device {
  position: absolute;
  inset: 0;
  font-size: calc(var(--ps-w) / 100);
  transform-style: preserve-3d;
}

.ps-back,
.ps-body {
  position: absolute;
  inset: 0;
  border-radius: 16.5em;
}

.ps-back {
  background: var(--ps-rim-dark);
  transform: translateZ(-4.5em);
  box-shadow: 0 6em 14em rgba(0, 0, 0, var(--ps-shadow)), 0 2em 4em rgba(0, 0, 0, calc(var(--ps-shadow) * 0.6));
}

.ps-body {
  background: var(--ps-rim);
  box-shadow: inset 0 0 0 0.35em rgba(255, 255, 255, 0.35), inset 0 0 0 0.9em rgba(0, 0, 0, 0.12);
}

.ps-key {
  position: absolute;
  width: 1.2em;
  border-radius: 9999px;
  background: var(--ps-rim-dark);
}

.ps-bezel {
  position: absolute;
  inset: 1.3em;
  border-radius: 15.2em;
  background: #050505;
  box-shadow: inset 0 0 0 0.25em rgba(255, 255, 255, 0.06);
}

.ps-screen {
  position: absolute;
  inset: 3.6em;
  overflow: hidden;
  border-radius: 12.9em;
  background: #000;
}

.ps-screen img,
.ps-screen video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.ps-island {
  position: absolute;
  left: 50%;
  top: 2.6em;
  width: 27em;
  height: 7.8em;
  margin-left: -13.5em;
  border-radius: 9999px;
  background: #000;
}

.ps-glare {
  position: absolute;
  inset: 0;
  background: linear-gradient(118deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0) 38%);
  pointer-events: none;
}

.ps-ui {
  position: absolute;
  inset: 0;
  padding: 21em 7em 0;
  background: #f6f5f2;
  color: #0a0a0a;
  font-family: var(--ps-font);
  letter-spacing: -0.04em;
}

.ps-status {
  position: absolute;
  left: 1.6em;
  right: 1.6em;
  top: 0.75em;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 4.6em;
  font-weight: 600;
}

.ps-dots {
  display: flex;
  gap: 0.25em;
}

.ps-dots i {
  width: 0.55em;
  height: 0.55em;
  border-radius: 50%;
  background: currentColor;
}

.ps-kicker {
  font-size: 4.2em;
  font-weight: 500;
  opacity: 0.45;
}

.ps-title {
  margin: 0.05em 0 0.35em;
  font-size: 13em;
  font-weight: 600;
  letter-spacing: -0.06em;
  line-height: 1;
}

.ps-hero {
  height: 78em;
  background: linear-gradient(160deg, var(--ps-accent), #0a0a0a 140%);
}

.ps-row {
  display: flex;
  align-items: center;
  gap: 4em;
  margin-top: 6em;
}

.ps-row i {
  width: 12em;
  height: 12em;
  border-radius: 50%;
  background: var(--ps-accent);
  opacity: 0.85;
}

.ps-row:nth-child(odd) i {
  background: #0a0a0a;
}

.ps-row b,
.ps-row s {
  display: block;
  height: 3.4em;
  background: #0a0a0a;
}

.ps-row b {
  width: 38em;
  opacity: 0.85;
}

.ps-row s {
  width: 24em;
  margin-top: 2.4em;
  opacity: 0.2;
}
`;
