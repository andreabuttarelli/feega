export const WHEEL_CSS = String.raw`
.ww {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--ww-bg);
  font-family: var(--ww-font);
  -webkit-font-smoothing: antialiased;
}

.ww-glow {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(48% 42% at 72% 4%, color-mix(in srgb, var(--ww-accent) 30%, transparent) 0%, transparent 70%),
    radial-gradient(36% 46% at 4% 0%, color-mix(in srgb, var(--ww-accent) 16%, transparent) 0%, transparent 72%),
    radial-gradient(30% 30% at 34% 52%, color-mix(in srgb, var(--ww-accent) 7%, transparent) 0%, transparent 70%);
}

.ww-stage {
  position: absolute;
  inset: 0;
}

.ww-panel {
  position: absolute;
  left: 0;
  top: 0;
  overflow: hidden;
  transform-origin: 0 50%;
  container-type: size;
  background: linear-gradient(180deg, #161a19 0%, #0f1211 55%, #0b0d0c 100%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07), inset 0 1px 0 0 color-mix(in srgb, var(--ww-accent) 45%, transparent), 0 4vmin 12vmin rgba(0, 0, 0, 0.6);
  will-change: transform, opacity;
}

.ww-ui {
  position: absolute;
  inset: 0;
  display: flex;
  color: #e9ecea;
}

.ww-side {
  flex: 0 0 26cqw;
  padding: 2.2cqw 1.8cqw;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.015);
  display: flex;
  flex-direction: column;
  gap: 0.9cqw;
}

.ww-chip {
  display: flex;
  align-items: center;
  gap: 0.8cqw;
  padding: 1.5cqw 1.4cqw;
  background: linear-gradient(180deg, #232826, #1a1e1d);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
  margin-bottom: 2.4cqw;
}

.ww-logo {
  width: 2.1cqw;
  height: 2.1cqw;
  flex: none;
}

.ww-brand {
  font-size: 1.9cqw;
  font-weight: 600;
  letter-spacing: -0.02em;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
}

.ww-pill {
  font-size: 0.85cqw;
  padding: 0.25cqw 0.7cqw;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.1);
  color: #b8bdbb;
}

.ww-label {
  font-size: 1cqw;
  color: #7c827f;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.2cqw;
}

.ww-label svg {
  width: 1.1cqw;
  height: 1.1cqw;
}

.ww-item {
  font-size: 1.05cqw;
  color: #c9cecc;
  display: flex;
  align-items: center;
  gap: 0.9cqw;
  padding: 0.9cqw 1cqw;
}

.ww-item::before {
  content: '';
  width: 0.6cqw;
  height: 0.6cqw;
  border-radius: 50%;
  background: #8d9390;
}

.ww-item.is-on {
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
}

.ww-item.is-on::before {
  background: #ffffff;
}

.ww-main {
  flex: 1;
  position: relative;
  padding: 2.4cqw 2.6cqw;
  display: flex;
  flex-direction: column;
  gap: 2cqw;
  min-width: 0;
}

.ww-hello {
  font-size: 2.6cqw;
  line-height: 1.12;
  letter-spacing: -0.02em;
  color: #cfd4d2;
  white-space: nowrap;
}

.ww-hello b {
  color: #ffffff;
  font-weight: 600;
}

.ww-status {
  display: flex;
  gap: 2.2cqw;
  font-size: 0.95cqw;
  color: #6f7572;
  margin-top: 0.6cqw;
}

.ww-ok {
  display: flex;
  align-items: center;
  gap: 0.6cqw;
  color: var(--ww-accent);
}

.ww-ok svg {
  width: 1.3cqw;
  height: 1.3cqw;
  flex: none;
}

.ww-card {
  padding: 2.4cqw 2.6cqw;
  background: rgba(255, 255, 255, 0.025);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 1.3cqw;
}

.ww-kicker {
  font-size: 1.05cqw;
  color: color-mix(in srgb, var(--ww-accent) 80%, #ffffff);
}

.ww-head {
  font-size: 3.5cqw;
  line-height: 1.12;
  letter-spacing: -0.025em;
  color: #e6e9e8;
  white-space: pre;
  padding-bottom: 1.4cqw;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.ww-copy {
  font-size: 1.1cqw;
  line-height: 1.45;
  color: #868c89;
  max-width: 46cqw;
}

.ww-actions {
  display: flex;
  gap: 1.4cqw;
}

.ww-button {
  display: flex;
  align-items: center;
  gap: 0.8cqw;
  font-size: 1.05cqw;
  font-weight: 500;
  padding: 1.2cqw 1.8cqw;
  background: rgba(255, 255, 255, 0.04);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
}

.ww-button svg {
  width: 1.3cqw;
  height: 1.3cqw;
}

.ww-news {
  font-size: 1.35cqw;
  font-weight: 600;
}

.ww-row {
  display: grid;
  grid-template-columns: 1.6cqw 1fr;
  column-gap: 1cqw;
  row-gap: 0.4cqw;
  font-size: 1.15cqw;
  color: #f0f2f1;
}

.ww-row small {
  grid-column: 2;
  font-size: 1cqw;
  color: #868c89;
  line-height: 1.4;
}

.ww-row .ww-ok {
  grid-row: span 2;
  align-self: start;
}

.ww-shot {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ww-shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(112deg, rgba(255, 255, 255, 0.04) 0%, transparent 30%), linear-gradient(180deg, transparent 60%, rgba(2, 4, 3, 0.55) 100%);
}

.ww-text {
  position: absolute;
  left: 0;
  top: 0;
  font-weight: 500;
  letter-spacing: -0.035em;
  line-height: 1;
  white-space: nowrap;
}

.ww-lead {
  position: absolute;
  left: 0;
  top: 0;
  color: var(--ww-ink);
  will-change: transform, opacity;
}

.ww-wheel {
  position: absolute;
  left: 0;
  top: 0;
  height: 1em;
  perspective: 8em;
  perspective-origin: 0 50%;
}

.ww-word {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform, opacity, color;
  backface-visibility: hidden;
}

.ww-measure {
  position: absolute;
  visibility: hidden;
  white-space: nowrap;
  font-size: 100px;
}
`;
