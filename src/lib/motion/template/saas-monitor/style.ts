export const MOCKUP_CSS = String.raw`
.sm {
  --ink: #0b0b10;
  --muted: #6b6b78;
  --line: #ececf2;
  --silver: linear-gradient(90deg, #8e9198 0%, #dfe1e6 22%, #f6f7f9 38%, #b8bbc2 58%, #eceef1 78%, #9a9da4 100%);
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--sm-font);
  -webkit-font-smoothing: antialiased;
  background: radial-gradient(130% 110% at 18% 8%, var(--sm-from) 0%, color-mix(in srgb, var(--sm-from) 45%, var(--sm-to)) 48%, var(--sm-to) 100%);
}

.sm-light {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(42% 46% at 50% 56%, color-mix(in srgb, var(--sm-accent) 38%, transparent) 0%, transparent 72%),
    radial-gradient(70% 55% at 30% 0%, rgba(255, 255, 255, 0.45) 0%, transparent 70%);
}

.sm-mark {
  position: absolute;
  left: 50%;
  top: 50%;
  margin: 0;
  white-space: nowrap;
  line-height: 0.74;
  font-weight: 700;
  letter-spacing: -0.06em;
  color: var(--sm-mark-ink);
  will-change: transform;
}

.sm-stage {
  position: absolute;
  inset: 0;
  perspective-origin: 50% 42%;
}

.sm-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.sm-screen {
  position: absolute;
  left: 0;
  top: 0;
  overflow: hidden;
  background: #ffffff;
  transform-origin: 0 0;
}

.sm-content {
  position: absolute;
  inset: 0;
  container-type: size;
}

.sm-glass {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(112deg, transparent 0%, transparent var(--sm-sheen-a), rgba(255, 255, 255, 0.16) var(--sm-sheen-b), transparent var(--sm-sheen-c), transparent 100%);
}

.sm-media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sm-page {
  position: relative;
  color: var(--ink);
  will-change: transform;
}

.sm-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 5.2cqw;
  padding: 0 4cqw;
  border-bottom: 1px solid var(--line);
  font-size: 1.02cqw;
}

.sm-logo {
  display: flex;
  align-items: center;
  gap: 0.6cqw;
  font-weight: 650;
  font-size: 1.22cqw;
  letter-spacing: -0.03em;
}

.sm-logo i {
  width: 1.5cqw;
  height: 1.5cqw;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, color-mix(in srgb, var(--sm-accent) 40%, #fff), var(--sm-accent) 60%, color-mix(in srgb, var(--sm-accent) 60%, #000));
}

.sm-links {
  display: flex;
  gap: 2.4cqw;
  color: var(--muted);
}

.sm-actions {
  display: flex;
  align-items: center;
  gap: 1.6cqw;
}

.sm-btn {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  font-weight: 560;
  white-space: nowrap;
}

.sm-actions .sm-btn {
  padding: 0.62cqw 1.3cqw;
  background: var(--ink);
  color: #fff;
}

.sm-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 5.4cqw;
  text-align: center;
}

.sm-badge {
  padding: 0.42cqw 1cqw;
  border: 1px solid var(--line);
  border-radius: 9999px;
  font-size: 0.92cqw;
  color: var(--muted);
}

.sm-badge b {
  color: var(--sm-accent);
  font-weight: 600;
}

.sm-h1 {
  margin: 1.7cqw 0 0;
  font-size: 4.7cqw;
  line-height: 1.02;
  font-weight: 700;
  letter-spacing: -0.05em;
}

.sm-char {
  white-space: pre;
}

.sm-caret {
  display: inline-block;
  width: 0.06em;
  height: 0.86em;
  margin: 0 -0.03em;
  vertical-align: -0.06em;
  background: var(--sm-accent);
}

.sm-sub {
  max-width: 42cqw;
  margin: 1.5cqw 0 0;
  font-size: 1.32cqw;
  line-height: 1.45;
  color: var(--muted);
}

.sm-ctas {
  display: flex;
  gap: 0.9cqw;
  margin-top: 2.2cqw;
  font-size: 1.12cqw;
}

.sm-ctas .sm-btn {
  padding: 0.95cqw 1.9cqw;
}

.sm-cta {
  background: var(--ink);
  color: #fff;
}

.sm-ghost {
  border: 1px solid #dcdce4;
  color: var(--ink);
}

.sm-product {
  position: relative;
  height: 46cqw;
  margin: 4.4cqw 3cqw 0;
  overflow: hidden;
  background: linear-gradient(165deg, color-mix(in srgb, var(--sm-accent) 70%, #fff) 0%, var(--sm-accent) 45%, color-mix(in srgb, var(--sm-accent) 70%, #1a0b4a) 100%);
}

.sm-app {
  position: absolute;
  left: 5cqw;
  right: 5cqw;
  top: 4.2cqw;
  bottom: -2cqw;
  display: flex;
  background: #fff;
  box-shadow: 0 2cqw 5cqw rgba(30, 10, 80, 0.35);
  font-size: 0.95cqw;
}

.sm-side {
  width: 15cqw;
  padding: 1.8cqw 1.4cqw;
  border-right: 1px solid var(--line);
  background: #fafafc;
}

.sm-side-row {
  padding: 0.6cqw 0.8cqw;
  color: var(--muted);
}

.sm-side-row.on {
  background: color-mix(in srgb, var(--sm-accent) 12%, #fff);
  color: var(--ink);
  font-weight: 600;
}

.sm-main {
  flex: 1;
  padding: 2cqw 2.4cqw;
}

.sm-main h3 {
  margin: 0;
  font-size: 1.7cqw;
  letter-spacing: -0.04em;
}

.sm-main p {
  margin: 0.4cqw 0 0;
  color: var(--muted);
}

.sm-stats {
  display: flex;
  gap: 1.2cqw;
  margin-top: 1.8cqw;
}

.sm-stat {
  flex: 1;
  padding: 1.1cqw 1.2cqw;
  border: 1px solid var(--line);
}

.sm-stat span {
  color: var(--muted);
}

.sm-stat b {
  display: block;
  margin-top: 0.4cqw;
  font-size: 2cqw;
  letter-spacing: -0.04em;
}

.sm-chart {
  display: flex;
  align-items: flex-end;
  gap: 0.7cqw;
  height: 11cqw;
  margin-top: 1.6cqw;
  padding: 1cqw 1.2cqw 0;
  border: 1px solid var(--line);
}

.sm-bar {
  flex: 1;
  height: 100%;
  background: color-mix(in srgb, var(--sm-accent) 22%, #fff);
  transform-origin: 50% 100%;
}

.sm-bar.on {
  background: var(--sm-accent);
}

.sm-cursor {
  position: absolute;
  left: 0;
  top: 0;
  width: 2.6cqw;
  height: 2.6cqw;
  will-change: transform, opacity;
}

.sm-grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-size: 180px 180px;
}

.sm[data-finish='black'] {
  --sm-bezel: #09090b;
  --sm-bezel-hi: #1f1f24;
  --sm-rim: rgba(255, 255, 255, 0.1);
  --sm-edge: #0d0d10;
  --sm-edge-hi: #3a3a40;
  --sm-shell: #18181c;
}

.sm[data-finish='silver'] {
  --sm-bezel: #c4c7cd;
  --sm-bezel-hi: #eef0f2;
  --sm-rim: rgba(0, 0, 0, 0.12);
  --sm-edge: #9a9da4;
  --sm-edge-hi: #e6e8eb;
  --sm-shell: #d7d9de;
}
`;
