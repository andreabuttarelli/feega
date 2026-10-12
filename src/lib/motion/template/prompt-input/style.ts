export const PROMPT_CSS = String.raw`
.pi {
  position: absolute;
  inset: 0;
  container-type: size;
  display: grid;
  place-items: center;
  background: var(--pi-bg);
  overflow: hidden;
}

.pi-stage {
  position: relative;
  font-family: var(--pi-font);
  font-size: calc(var(--pi-size) * 1cqmin);
  font-weight: var(--pi-weight);
  color: var(--pi-ink);
  -webkit-font-smoothing: antialiased;
  transform-origin: 50% 50%;
  will-change: transform;
}

.pi-box {
  --pi-focus: 0;
  position: relative;
  box-sizing: border-box;
  width: min(calc(var(--pi-width) * 1em), 92cqw);
  padding: 1em 0.8em 0.8em 1.2em;
  border-radius: var(--pi-radius);
  background: var(--pi-field);
  box-shadow:
    inset 0 1px 0 var(--pi-highlight),
    0 0 0 1px color-mix(in srgb, var(--pi-accent) calc(var(--pi-focus) * 60%), var(--pi-line)),
    0 0 0 calc(var(--pi-focus) * 0.24em) color-mix(in srgb, var(--pi-accent) 14%, transparent),
    0 1px 2px rgba(0, 0, 0, calc(0.05 * var(--pi-depth))),
    0 0.7em 1.6em -0.4em rgba(0, 0, 0, calc(0.1 * var(--pi-depth))),
    0 2.6em 5em -1.2em rgba(0, 0, 0, calc(0.18 * var(--pi-depth)));
}

.pi-text {
  position: relative;
  padding-right: 0.4em;
  line-height: 1.42;
  letter-spacing: -0.012em;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.pi-ghost {
  visibility: hidden;
}

.pi-line,
.pi-placeholder,
.pi-thinking {
  position: absolute;
  inset: 0 0.4em auto 0;
}

.pi-placeholder,
.pi-thinking {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pi-placeholder {
  color: var(--pi-muted);
}

.pi-thinking {
  width: max-content;
  max-width: 100%;
  color: transparent;
  background-image: linear-gradient(90deg, var(--pi-muted) 0%, var(--pi-muted) 32%, var(--pi-ink) 50%, var(--pi-muted) 68%, var(--pi-muted) 100%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
}

.pi-caret {
  display: inline-block;
  width: 0.09em;
  height: 1.12em;
  margin-left: 0.05em;
  vertical-align: -0.2em;
  background: var(--pi-accent);
}

.pi-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6em;
  margin-top: 0.9em;
  margin-left: -0.35em;
}

.pi-tools,
.pi-chips {
  display: flex;
  align-items: center;
  gap: 0.4em;
  min-width: 0;
}

.pi-plus {
  display: grid;
  place-items: center;
  flex: none;
  width: 1.9em;
  height: 1.9em;
  border-radius: 9999px;
  color: var(--pi-muted);
  box-shadow: inset 0 0 0 1px var(--pi-line);
}

.pi-glyph {
  width: 0.95em;
  height: 0.95em;
}

.pi-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45em;
  height: 2.35em;
  padding: 0 0.95em 0 0.8em;
  border-radius: 9999px;
  background: var(--pi-chip);
  color: var(--pi-ink);
  font-size: 0.8em;
  letter-spacing: -0.005em;
  white-space: nowrap;
}

.pi-chip-icon {
  width: 1.1em;
  height: 1.1em;
  color: var(--pi-muted);
  stroke-width: 1.8;
}

.pi-dot {
  width: 0.5em;
  height: 0.5em;
  border-radius: 9999px;
  background: var(--pi-accent);
}

.pi-send {
  --pi-armed: 0;
  position: relative;
  flex: none;
}

.pi-send-face {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45em;
  height: 2.2em;
  min-width: 2.2em;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--pi-accent) calc(var(--pi-armed) * 100%), var(--pi-idle));
  color: color-mix(in srgb, #ffffff calc(var(--pi-armed) * 100%), var(--pi-muted));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, calc(0.22 * var(--pi-armed))),
    0 0.35em 0.9em -0.25em color-mix(in srgb, var(--pi-accent) calc(var(--pi-armed) * 70%), transparent);
}

.pi-labelled .pi-send-face {
  padding: 0 0.85em 0 1.05em;
}

.pi-label {
  font-size: 0.82em;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.pi-label:empty {
  display: none;
}

.pi-icons {
  position: relative;
  width: 1em;
  height: 1em;
}

.pi-icon,
.pi-stop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.pi-icon svg {
  display: block;
  width: 100%;
  height: 100%;
}

.pi-cursor {
  --pi-cx: 2;
  --pi-cy: 2;
  --pi-cpress: 0;
  position: absolute;
  left: 50%;
  top: 50%;
  width: 1.35em;
  height: 1.35em;
  pointer-events: none;
  transform: translate(calc(var(--pi-cx) * 2.2em - 0.28em), calc(var(--pi-cy) * 2.2em - 0.18em)) scale(calc(1 - 0.12 * var(--pi-cpress)));
  transform-origin: 21% 13%;
  filter: drop-shadow(0 0.08em 0.16em rgba(0, 0, 0, 0.28));
}

.pi-pointer {
  display: block;
  width: 100%;
  height: 100%;
}
`;
