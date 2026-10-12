export const CAROUSEL_CSS = String.raw`
.cc {
  position: absolute;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: var(--cc-bg);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.cc.cc-drag {
  cursor: grab;
}

.cc.cc-dragging {
  cursor: grabbing;
}

.cc-ring {
  position: absolute;
  left: 50%;
  top: 44%;
  width: 0;
  height: 0;
  transform-style: preserve-3d;
}

.cc-item {
  position: absolute;
  left: 0;
  top: 0;
  overflow: hidden;
  border-radius: var(--cc-radius);
  background: var(--cc-empty);
  box-shadow: 0 calc(var(--cc-shadow) * 4cqmin) calc(var(--cc-shadow) * 9cqmin) rgba(0, 0, 0, calc(var(--cc-shadow) * 0.9));
  backface-visibility: hidden;
  will-change: transform, opacity;
}

.cc-item img,
.cc-item video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  -webkit-user-drag: none;
}

.cc-shade {
  position: absolute;
  inset: 0;
  background: var(--cc-bg);
  pointer-events: none;
}

.cc-caption {
  position: absolute;
  left: 0;
  right: 0;
  margin: 0;
  text-align: center;
  pointer-events: none;
  font-family: var(--cc-font);
  font-size: calc(var(--cc-size) * 1cqmin);
  font-weight: var(--cc-weight);
  letter-spacing: var(--cc-tracking);
  line-height: 1.1;
  color: var(--cc-ink);
  -webkit-font-smoothing: antialiased;
  will-change: transform, opacity;
}

.cc-controls {
  position: absolute;
  left: 50%;
  bottom: 6cqmin;
  display: flex;
  gap: 2.2cqmin;
  transform: translateX(-50%);
}

.cc-btn {
  display: grid;
  place-items: center;
  width: 7.4cqmin;
  height: 7.4cqmin;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  color: var(--cc-btn);
  background: transparent;
  cursor: pointer;
}

.cc-btn svg {
  width: 38%;
  height: 38%;
  pointer-events: none;
}

.cc-btn-glass {
  background: color-mix(in srgb, var(--cc-btn) 14%, transparent);
  border-color: color-mix(in srgb, var(--cc-btn) 22%, transparent);
  backdrop-filter: blur(12px);
}

.cc-btn-solid {
  background: var(--cc-btn);
  color: var(--cc-bg);
}

.cc-btn-outline {
  border-color: color-mix(in srgb, var(--cc-btn) 55%, transparent);
}
`;
