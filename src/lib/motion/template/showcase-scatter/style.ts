export const SS_CSS = String.raw`
.ss {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--ss-bg);
  color: var(--ss-ink);
  font-family: var(--ss-font);
  -webkit-font-smoothing: antialiased;
}

.ss-title {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  z-index: 1;
}

.ss-headline {
  margin: 0;
  padding: 0 6%;
  text-align: center;
  font-weight: var(--ss-weight);
  letter-spacing: var(--ss-tracking);
  line-height: 0.95;
  white-space: nowrap;
}

.ss-word {
  display: inline-block;
  white-space: pre;
}

.ss-cards {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2;
}

.ss-card {
  position: absolute;
  overflow: hidden;
  background: var(--ss-empty);
  will-change: transform, opacity;
}

.ss-hero {
  z-index: 3;
}

.ss-card img,
.ss-card video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ss-round {
  border-radius: 50%;
}

.ss-block {
  background: var(--ss-block);
}

.ss-dots {
  background: var(--ss-dots);
}

.ss-sq,
.ss-ci {
  position: absolute;
  width: 7%;
  height: 7%;
  background: var(--ss-ink);
}

.ss-ci {
  border-radius: 50%;
}

.ss-a { left: 32%; top: 30%; }
.ss-b { left: 61%; top: 30%; }
.ss-c { left: 47%; top: 50%; }
.ss-d { left: 32%; top: 64%; }
.ss-e { left: 61%; top: 66%; }

.ss-type {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: var(--ss-paper);
  line-height: 1.08;
  letter-spacing: -0.02em;
}

.ss-type-0 { font-weight: 300; }
.ss-type-1 { font-weight: 600; }
.ss-type-2 { font-weight: 700; }

.ss-meta {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  line-height: 1;
  font-weight: 450;
  letter-spacing: -0.01em;
}

.ss-m {
  position: absolute;
  white-space: nowrap;
}

.ss-m1 { left: 36%; top: 3.2%; }
.ss-m2 { left: 64%; top: 3.2%; }
.ss-m3 { right: 5%; top: 3.2%; }
.ss-m4 { left: 5%; bottom: 3.6%; }
.ss-m5 { right: 5%; bottom: 3.6%; }
`;
