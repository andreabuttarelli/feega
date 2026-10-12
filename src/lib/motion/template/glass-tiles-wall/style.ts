export const GTW_CSS = String.raw`
.gt {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: radial-gradient(120% 90% at 50% 45%, color-mix(in srgb, var(--gt-bg) 82%, #3a4470), var(--gt-bg));
  font-family: var(--gt-font);
  -webkit-font-smoothing: antialiased;
}

.gt-wall {
  position: absolute;
  inset: 0;
  perspective-origin: 50% 50%;
}

.gt-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(140% 110% at 50% 50%, transparent 55%, color-mix(in srgb, var(--gt-bg) 70%, transparent));
}

.gt-tile {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--gt-w);
  height: var(--gt-h);
  margin: calc(var(--gt-h) / -2) 0 0 calc(var(--gt-w) / -2);
  border-radius: var(--gt-radius);
  overflow: hidden;
  background: var(--gt-empty);
  will-change: transform;
  backface-visibility: hidden;
  box-shadow:
    0 calc(var(--gt-w) * 0.03) calc(var(--gt-w) * 0.08) rgba(0, 0, 0, 0.55),
    inset 0 0 0 1px rgba(255, 255, 255, calc(0.3 * var(--gt-glass)));
}

.gt-rim,
.gt-face,
.gt-gloss,
.gt-shade {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}

.gt-rim img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.12);
  filter: brightness(1.35) saturate(0.7);
}

.gt-rim::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(170deg, rgba(255, 255, 255, calc(0.42 * var(--gt-glass))), rgba(255, 255, 255, calc(0.08 * var(--gt-glass))) 45%, rgba(255, 255, 255, calc(0.22 * var(--gt-glass))));
}

.gt-face {
  inset: calc(var(--gt-w) * 0.028 * var(--gt-glass));
  border-radius: calc(var(--gt-radius) * 0.8);
  overflow: hidden;
  background: var(--gt-empty);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.35),
    0 calc(var(--gt-w) * -0.004) calc(var(--gt-w) * 0.012) rgba(255, 255, 255, calc(0.35 * var(--gt-glass)));
}

.gt-face img,
.gt-face video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.04);
}

.gt-dim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.35), transparent 26%, transparent 46%, rgba(0, 0, 0, 0.55) 100%),
    radial-gradient(120% 100% at 50% 40%, transparent 55%, rgba(0, 0, 0, calc(0.45 * var(--gt-glass))));
  box-shadow: inset 0 0 calc(var(--gt-w) * 0.05) rgba(0, 0, 0, calc(0.5 * var(--gt-glass)));
}

.gt-meta {
  position: absolute;
  left: 6%;
  right: 6%;
  top: 7%;
  display: flex;
  justify-content: space-between;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: calc(var(--gt-w) * 0.022);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--gt-ink);
  opacity: 0.55;
}

.gt-rule {
  position: absolute;
  left: 6%;
  right: 6%;
  top: 58%;
  height: 1px;
  background: var(--gt-ink);
  opacity: 0.35;
}

.gt-text {
  position: absolute;
  left: 6%;
  right: 6%;
  top: 61%;
  color: var(--gt-ink);
}

.gt-name {
  margin: 0;
  font-size: calc(var(--gt-w) * 0.115);
  font-weight: var(--gt-weight);
  letter-spacing: var(--gt-tracking);
  line-height: 1;
  white-space: nowrap;
  text-shadow: 0 0 calc(var(--gt-w) * 0.02) rgba(0, 0, 0, 0.35);
}

.gt-cap {
  margin: calc(var(--gt-w) * 0.025) 0 0;
  font-size: calc(var(--gt-w) * 0.026);
  line-height: 1.2;
  opacity: 0.7;
  white-space: nowrap;
}

.gt-gloss {
  overflow: hidden;
  background:
    radial-gradient(70% 30% at 30% 0%, rgba(255, 255, 255, calc(0.45 * var(--gt-glass))), transparent 70%),
    linear-gradient(180deg, rgba(255, 255, 255, calc(0.16 * var(--gt-glass))), transparent 22%, transparent 80%, rgba(255, 255, 255, calc(0.1 * var(--gt-glass))));
  box-shadow:
    inset 0 calc(var(--gt-w) * 0.006) calc(var(--gt-w) * 0.004) rgba(255, 255, 255, calc(0.55 * var(--gt-glass))),
    inset 0 calc(var(--gt-w) * -0.008) calc(var(--gt-w) * 0.016) rgba(0, 0, 0, calc(0.5 * var(--gt-glass))),
    inset calc(var(--gt-w) * 0.006) 0 calc(var(--gt-w) * 0.01) rgba(255, 255, 255, calc(0.18 * var(--gt-glass))),
    inset calc(var(--gt-w) * -0.006) 0 calc(var(--gt-w) * 0.01) rgba(255, 255, 255, calc(0.12 * var(--gt-glass)));
}

.gt-gloss b {
  position: absolute;
  inset: -50% -100%;
  background: linear-gradient(105deg, transparent 42%, rgba(255, 255, 255, calc(0.16 * var(--gt-glass))) 48%, rgba(255, 255, 255, calc(0.05 * var(--gt-glass))) 53%, transparent 58%);
  will-change: transform;
}

.gt-shade {
  background: #000;
  opacity: 0;
}
`;
