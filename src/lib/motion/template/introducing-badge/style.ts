export const BADGE_CSS = String.raw`
.ib {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background:
    radial-gradient(60cqmax 50cqmax at 0% 0%, color-mix(in srgb, var(--ib-glow) 22%, transparent), transparent 70%),
    radial-gradient(60cqmax 50cqmax at 100% 0%, color-mix(in srgb, var(--ib-glow) 16%, transparent), transparent 70%),
    var(--ib-bg);
  font-family: var(--ib-font);
  -webkit-font-smoothing: antialiased;
}

.ib-planet {
  position: absolute;
  left: 50%;
  top: 0;
  width: 150cqmin;
  height: 150cqmin;
  margin-left: -75cqmin;
  border-radius: 50%;
  background: radial-gradient(70% 45% at 50% 0%, color-mix(in srgb, var(--ib-glow) 20%, var(--ib-bg)), var(--ib-bg) 100%);
  box-shadow:
    inset 0 0.25cqmin 0.3cqmin color-mix(in srgb, var(--ib-glow) 90%, white 10%),
    inset 0 3cqmin 6cqmin color-mix(in srgb, var(--ib-glow) 30%, transparent),
    0 -1cqmin 14cqmin color-mix(in srgb, var(--ib-glow) 35%, transparent);
  will-change: transform, opacity;
}

.ib-row {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.15em;
  font-size: calc(var(--ib-size) * 1cqmin);
  font-weight: var(--ib-weight);
  letter-spacing: var(--ib-tracking);
  line-height: 1;
  color: var(--ib-ink);
  white-space: pre;
  transform: translateY(-4cqh);
}

@container (aspect-ratio < 1.25) {
  .ib-row {
    flex-direction: column;
    gap: 0.6em;
  }
}

.ib-words {
  display: flex;
}

.ib-name {
  display: grid;
  color: var(--ib-accent);
}

.ib-feature {
  grid-area: 1 / 1;
  will-change: transform, opacity;
}

@container (aspect-ratio < 1.25) {
  .ib-feature {
    justify-self: center;
  }
}

.ib-word {
  display: inline-block;
  will-change: transform, opacity;
}

.ib-badge {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.24em;
  padding: 0.42em 0.62em 0.42em 0.5em;
  overflow: hidden;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.04));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 -1px 0 color-mix(in srgb, var(--ib-accent) 45%, transparent),
    0 0.5em 1.4em rgba(0, 0, 0, 0.55);
  letter-spacing: -0.03em;
  will-change: transform, opacity;
}

.ib-glyph {
  width: 0.92em;
  height: 0.92em;
  flex: none;
  fill: var(--ib-accent);
}

.ib-glyph-image {
  width: 1em;
  height: 1em;
  flex: none;
  object-fit: contain;
}

.ib-mark {
  font-weight: 650;
}

.ib-suffix {
  margin-left: -0.2em;
  font-weight: 300;
  opacity: 0.72;
}

.ib-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 35%, rgba(255, 255, 255, 0.3) 50%, transparent 65%);
  pointer-events: none;
}
`;
