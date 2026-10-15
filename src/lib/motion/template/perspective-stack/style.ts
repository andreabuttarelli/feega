export const PS_CSS = String.raw`
.ps {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--ps-bg);
}

.ps-deck {
  position: absolute;
}

.ps-card {
  position: absolute;
  overflow: hidden;
  border-radius: var(--ps-radius);
  transform-origin: 50% 100%;
  will-change: transform, opacity;
}

.ps-photo {
  position: absolute;
  inset: 0;
  background: linear-gradient(160deg, #ffffff, var(--ps-product) 55%, #cfcfcf);
}

.ps-photo img,
.ps-photo video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ps-colourA {
  background: linear-gradient(170deg, var(--ps-a), rgba(0, 0, 0, 0.18)), var(--ps-a);
}

.ps-colourB {
  background: linear-gradient(170deg, var(--ps-b), rgba(255, 255, 255, 0.08)), var(--ps-b);
}

.ps-colourC {
  background: linear-gradient(170deg, rgba(255, 255, 255, 0.25), var(--ps-c)), var(--ps-c);
}

.ps-floor {
  position: absolute;
  will-change: transform;
}

.ps-plate {
  position: absolute;
  left: 0;
  right: 0;
  height: 100%;
  overflow: hidden;
  border-radius: calc(var(--ps-radius) * 0.6);
  transform-origin: 50% 100%;
  transform: rotateX(var(--ps-floor-tilt));
}

.ps-plate-back {
  top: -26%;
  left: 7%;
  right: 7%;
  background: linear-gradient(200deg, var(--ps-floor-back), rgba(255, 255, 255, 0.28)), var(--ps-floor-back);
}

.ps-plate-front {
  top: 6%;
  height: 120%;
  background: var(--ps-floor-front);
}

.ps-liquid {
  position: absolute;
  inset: 18% 10% -30% 10%;
}

.ps-blob {
  position: absolute;
  width: 70%;
  height: 90%;
  border-radius: 50%;
  will-change: transform;
}

.ps-blob-a {
  left: 0;
  top: 10%;
  background: radial-gradient(closest-side, var(--ps-liquid-a), transparent);
}

.ps-blob-b {
  left: 30%;
  top: 20%;
  background: radial-gradient(closest-side, var(--ps-liquid-b), transparent);
}

.ps-blob-c {
  left: 15%;
  top: 35%;
  background: radial-gradient(closest-side, var(--ps-liquid-c), transparent);
}

.ps-caption {
  position: absolute;
  left: 5%;
  top: 3.5%;
  margin: 0;
  color: var(--ps-ink);
  font-family: var(--ps-font);
  font-weight: 500;
  letter-spacing: -0.04em;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
}
`;
