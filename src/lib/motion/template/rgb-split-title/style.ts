export const RGB_CSS = String.raw`
.rs {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--rs-bg);
}

.rs-defs {
  position: absolute;
  width: 0;
  height: 0;
}

.rs-photo {
  position: absolute;
  overflow: hidden;
  isolation: isolate;
  background: #000;
  filter: saturate(1.3) contrast(0.82) brightness(1.12);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 30%, #000 74%, transparent 100%);
  mask-image: linear-gradient(to right, transparent 0%, #000 30%, #000 74%, transparent 100%);
  will-change: transform;
}

.rs-channel {
  position: absolute;
  inset: -8%;
  isolation: isolate;
  mix-blend-mode: screen;
  will-change: transform, filter;
}

.rs-channel img,
.rs-channel video,
.rs-empty {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.rs-empty {
  background: var(--rs-empty);
}

.rs-tint {
  position: absolute;
  inset: 0;
  mix-blend-mode: multiply;
}

.rs-title {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  column-gap: 0.26em;
  padding: 0 6%;
  pointer-events: none;
  font-family: var(--rs-font);
  font-weight: var(--rs-weight);
  letter-spacing: var(--rs-tracking);
  line-height: 1.08;
  color: var(--rs-ink);
  text-align: center;
  -webkit-font-smoothing: antialiased;
}

.rs-word {
  display: inline-block;
  white-space: nowrap;
  will-change: transform, opacity;
}
`;
