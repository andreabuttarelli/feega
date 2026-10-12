export const TVS_CSS = String.raw`
.vt {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--vt-room);
}

.vt-defs {
  position: absolute;
  width: 0;
  height: 0;
}

.vt-light,
.vt-shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.vt-light {
  background: radial-gradient(60% 45% at 50% 46%, var(--vt-glow), transparent 70%);
  mix-blend-mode: soft-light;
}

.vt-shade {
  background: radial-gradient(120% 90% at 50% 45%, transparent 40%, rgba(0, 0, 0, 0.75) 100%);
}

.vt-wall {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
}

.vt-floor {
  position: absolute;
  left: -40%;
  right: -40%;
  height: 18%;
  background: radial-gradient(50% 50% at 50% 0%, rgba(0, 0, 0, 0.7), transparent 70%);
}

.vt-tv {
  position: absolute;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), inset 0 -0.6em 1.2em rgba(0, 0, 0, 0.35), 0 0.4em 0.9em rgba(0, 0, 0, 0.55);
}

.vt-walnut {
  background: repeating-linear-gradient(92deg, rgba(0, 0, 0, 0.08) 0 2px, transparent 2px 7px), linear-gradient(180deg, #5b3a25, #3a2417);
}

.vt-oak {
  background: repeating-linear-gradient(88deg, rgba(0, 0, 0, 0.07) 0 2px, transparent 2px 9px), linear-gradient(180deg, #8b6642, #5c4029);
}

.vt-cream {
  background: linear-gradient(180deg, #d8cdb8, #ab9f88);
}

.vt-charcoal {
  background: linear-gradient(180deg, #303032, #19191a);
}

.vt-lit {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, var(--vt-glow), transparent 80%);
  mix-blend-mode: soft-light;
  pointer-events: none;
}

.vt-bezel {
  position: absolute;
  background: #0b0b0c;
  box-shadow: inset 0 0 0.5em rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.vt-screen {
  position: absolute;
  overflow: hidden;
  border-radius: 10% / 13%;
  background: #121516;
  isolation: isolate;
}

.vt-halo {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(closest-side, var(--vt-glow), transparent);
  mix-blend-mode: screen;
  pointer-events: none;
}

.vt-picture {
  position: absolute;
  inset: 0;
  overflow: hidden;
  transform-origin: 50% 50%;
  background: #000;
}

.vt-media,
.vt-slide,
.vt-card,
.vt-noise,
.vt-scan,
.vt-roll,
.vt-flick,
.vt-flash,
.vt-glass {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.vt-slide {
  background: var(--vt-empty);
}

.vt-slide img,
.vt-slide video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(1.15) contrast(1.08);
}

.vt-card {
  display: grid;
  place-content: center;
  background: #050506;
  text-align: center;
  font-family: var(--vt-font);
  -webkit-font-smoothing: antialiased;
}

.vt-headline {
  margin: 0 auto;
  font-weight: var(--vt-weight);
  letter-spacing: var(--vt-tracking);
  line-height: 0.95;
  color: var(--vt-ink);
  text-shadow: 0 0 0.12em var(--vt-glow);
}

.vt-word {
  display: inline-block;
  white-space: pre;
}

.vt-noise {
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

.vt-scan {
  background: repeating-linear-gradient(180deg, rgba(0, 0, 0, 0.55) 0 35%, transparent 35% 100%);
}

.vt-roll {
  height: 35%;
  background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.07), transparent);
}

.vt-flick {
  background: #fff;
}

.vt-flash {
  background: radial-gradient(closest-side, #ffffff, var(--vt-glow) 60%, transparent);
}

.vt-glass {
  border-radius: inherit;
  background: radial-gradient(70% 55% at 32% 22%, rgba(255, 255, 255, 0.13), transparent 60%), radial-gradient(closest-side, transparent 62%, rgba(0, 0, 0, 0.6) 100%);
  box-shadow: inset 0 0 0.9em rgba(0, 0, 0, 0.85);
}

.vt-panel {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8%;
}

.vt-panel-side {
  flex-direction: column;
}

.vt-grille {
  background: repeating-linear-gradient(180deg, rgba(0, 0, 0, 0.55) 0 1px, transparent 1px 4px);
  box-shadow: inset 0 0 0.3em rgba(0, 0, 0, 0.4);
}

.vt-knob {
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #d9d4ca, #6d675f 55%, #2a2724);
  box-shadow: 0 0.12em 0.25em rgba(0, 0, 0, 0.6);
}

.vt-leg {
  position: absolute;
  background: linear-gradient(90deg, #2a1a10, #4a2f1d);
}

.vt-dome {
  position: absolute;
  border-radius: 50% 50% 0 0 / 100% 100% 0 0;
  background: linear-gradient(180deg, #4a4a4c, #1d1d1e);
}

.vt-rod {
  position: absolute;
  width: 2px;
  transform-origin: 50% 100%;
  background: linear-gradient(180deg, #e8e8e8, #8a8a8a);
}
`;
