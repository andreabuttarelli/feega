export const PATH_CSS = String.raw`
.pc {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: radial-gradient(120% 90% at 50% 40%, #ffffff 0%, var(--pc-bg) 70%);
  font-family: var(--pc-font);
  color: var(--pc-ink);
  -webkit-font-smoothing: antialiased;
}

.pc-world {
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  will-change: transform, opacity;
}

.pc-path {
  position: absolute;
  left: 0;
  top: 0;
  overflow: visible;
}

.pc-path path {
  fill: none;
  stroke: var(--pc-accent);
  stroke-linecap: round;
  stroke-dasharray: 1 2;
}

.pc-dot {
  position: absolute;
  left: 0;
  top: 0;
  width: calc(var(--pc-u) * 0.018);
  height: calc(var(--pc-u) * 0.018);
  margin: calc(var(--pc-u) * -0.009) 0 0 calc(var(--pc-u) * -0.009);
  border-radius: 50%;
  background: var(--pc-accent);
  box-shadow: 0 0 0 calc(var(--pc-u) * 0.004) #ffffff, 0 calc(var(--pc-u) * 0.004) calc(var(--pc-u) * 0.014) rgba(20, 40, 90, 0.25);
  will-change: transform, opacity;
}

.pc-card {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
  padding: calc(var(--pc-u) * 0.012);
  background: var(--pc-card);
  box-shadow: 0 calc(var(--pc-u) * 0.012) calc(var(--pc-u) * 0.04) rgba(30, 40, 80, 0.1), 0 0 0 1px rgba(30, 40, 80, 0.04);
  will-change: transform, opacity, filter;
}

.pc-place {
  width: calc(var(--pc-u) * 0.26);
}

.pc-review {
  width: calc(var(--pc-u) * 0.3);
  padding: calc(var(--pc-u) * 0.016);
}

.pc-photo {
  display: block;
  width: 100%;
  height: calc(var(--pc-u) * 0.15);
  object-fit: cover;
  background: #e6e9f0;
}

.pc-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: calc(var(--pc-u) * 0.01);
  margin-top: calc(var(--pc-u) * 0.012);
}

.pc-name {
  font-size: calc(var(--pc-u) * 0.021);
  font-weight: 500;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.pc-rate {
  font-size: calc(var(--pc-u) * 0.016);
  white-space: nowrap;
}

.pc-star {
  color: var(--pc-star);
}

.pc-address {
  margin-top: calc(var(--pc-u) * 0.004);
  font-size: calc(var(--pc-u) * 0.015);
  opacity: 0.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pc-who {
  display: flex;
  align-items: center;
  gap: calc(var(--pc-u) * 0.009);
  font-size: calc(var(--pc-u) * 0.017);
  font-weight: 500;
}

.pc-avatar {
  display: grid;
  place-items: center;
  width: calc(var(--pc-u) * 0.03);
  height: calc(var(--pc-u) * 0.03);
  border-radius: 50%;
  background: var(--pc-accent);
  color: #ffffff;
  font-size: calc(var(--pc-u) * 0.014);
  font-weight: 600;
}

.pc-stars {
  margin-top: calc(var(--pc-u) * 0.007);
  font-size: calc(var(--pc-u) * 0.015);
  letter-spacing: 0.08em;
  color: var(--pc-star);
}

.pc-text {
  margin: calc(var(--pc-u) * 0.006) 0 0;
  font-size: calc(var(--pc-u) * 0.017);
  line-height: 1.35;
  opacity: 0.85;
}
`;
