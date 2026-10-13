import { PHONE_DEVICE_CSS } from '../phone-device';

export const CHAT_CSS = String.raw`
.pc {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: radial-gradient(120% 90% at 50% 30%, #ffffff 0%, var(--pc-bg) 100%);
  font-family: var(--pc-font);
  -webkit-font-smoothing: antialiased;
}

.pc-cam {
  position: absolute;
  inset: 0;
  transform-origin: 50% 62%;
  will-change: transform;
}

.pc-phone {
  position: absolute;
  width: var(--ps-w);
  height: var(--ps-h);
  transform-style: preserve-3d;
}

${PHONE_DEVICE_CSS}

.pc-ui {
  position: absolute;
  inset: 0;
  font-size: var(--pc-em);
  background: linear-gradient(180deg, var(--pc-screen) 0%, #ffffff 100%);
  color: var(--pc-ink);
  font-family: var(--pc-font);
  overflow: hidden;
}

.pc-status {
  position: absolute;
  left: 13em;
  right: 9em;
  top: 1.2em;
  height: 6.4em;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pc-clock {
  font-size: 4.4em;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.pc-icons {
  display: flex;
  align-items: center;
  gap: 1.3em;
}

.pc-icons svg {
  display: block;
  height: 3.6em;
  width: auto;
}

.pc-round {
  position: absolute;
  top: 16.5em;
  width: 12.5em;
  height: 12.5em;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0.6em 2.4em rgba(0, 0, 0, 0.05);
}

.pc-round svg {
  width: 5.6em;
  height: 5.6em;
}

.pc-back {
  left: 5.5em;
}

.pc-video {
  right: 5.5em;
}

.pc-cluster {
  position: absolute;
  left: 50%;
  top: 13em;
  width: 19em;
  height: 19em;
  margin-left: -9.5em;
  border-radius: 50%;
  background: #e4e4e6;
}

.pc-cluster span {
  position: absolute;
  transform: translate(-50%, -50%);
}

.pc-title {
  position: absolute;
  left: 0;
  right: 0;
  top: 30em;
  display: flex;
  justify-content: center;
}

.pc-pill {
  display: flex;
  align-items: center;
  gap: 0.25em;
  padding: 0.2em 0.55em;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.92);
  font-size: 4.6em;
  font-weight: 700;
  letter-spacing: -0.025em;
  white-space: nowrap;
  line-height: 1.2;
}

.pc-more {
  font-weight: 400;
  opacity: 0.3;
}

.pc-list {
  position: absolute;
  left: 0;
  right: 0;
  top: 40.5em;
  bottom: 0;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 3em);
  mask-image: linear-gradient(180deg, transparent 0, #000 3em);
}

.pc-feed {
  display: flex;
  flex-direction: column;
  row-gap: 3.2em;
  padding: 1.5em 0 0 5em;
  will-change: transform, opacity;
}

.pc-slot {
  will-change: transform, opacity;
}

.pc-who {
  margin: 0 0 0.7em 5.1em;
  font-size: 2.8em;
  color: #8a8a8f;
}

.pc-row {
  display: flex;
  align-items: flex-end;
  gap: 2.6em;
}

.pc-avatar {
  flex: none;
  font-size: 8.6em;
  margin-bottom: 0.08em;
}

.pc-face {
  position: relative;
  display: block;
  width: 1em;
  height: 1em;
  overflow: hidden;
  border-radius: 50%;
  font-style: normal;
  box-shadow: inset 0 0 0 0.02em rgba(0, 0, 0, 0.06);
}

.pc-face b {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.42em;
  font-weight: 600;
  color: rgba(10, 10, 10, 0.62);
}

.pc-face img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pc-shell {
  position: relative;
  overflow: hidden;
  border-radius: 4.4em;
  background: var(--pc-bubble);
}

.pc-text {
  position: absolute;
  left: 0;
  top: 0;
  width: max-content;
  max-width: 13.8em;
  padding: 0.5em 0.82em 0.55em;
  font-size: 4.5em;
  line-height: 1.22;
  letter-spacing: -0.01em;
  will-change: transform, opacity;
}

.pc-dots {
  position: absolute;
  left: 0;
  top: 0;
  width: 14.5em;
  height: 9.2em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.2em;
}

.pc-dots i {
  width: 1.9em;
  height: 1.9em;
  border-radius: 50%;
  background: #8e8e93;
}
`;
