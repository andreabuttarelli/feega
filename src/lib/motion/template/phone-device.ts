export const PHONE_DEVICE = String.raw`
const FINISHES = {
  natural: ['linear-gradient(90deg, #77736d 0%, #cfccc5 4%, #a19d96 12%, #dedbd5 48%, #9a968f 88%, #d2cfc8 96%, #6f6b65 100%)', '#6b6863'],
  black: ['linear-gradient(90deg, #1c1c1e 0%, #6b6b70 4%, #303033 12%, #4a4a4e 48%, #2a2a2d 88%, #626267 96%, #18181a 100%)', '#202022'],
  white: ['linear-gradient(90deg, #b9b8b4 0%, #f7f6f3 4%, #dcdbd7 12%, #f2f1ee 48%, #d4d3cf 88%, #f5f4f1 96%, #aeada9 100%)', '#bdbcb8'],
  desert: ['linear-gradient(90deg, #8c7865 0%, #e3cfb9 4%, #b9a28b 12%, #dcc7b0 48%, #ae9780 88%, #e0ccb5 96%, #85715f 100%)', '#8f7b68']
};
const KEYS = [['left', 19, 6], ['left', 27, 11], ['left', 39.5, 11], ['right', 31, 17]];
const KEY_SHIFT = '-0.75em';

const keyHtml = ([side, top, length]) => '<span class="ps-key" style="' + side + ':' + KEY_SHIFT + ';top:' + top + '%;height:' + length + '%;transform:translateZ(-2.2em)"></span>';

const deviceHtml = (inner) => '<div class="ps-device">' + KEYS.map(keyHtml).join('') + '<div class="ps-back"></div><div class="ps-body"><div class="ps-bezel"></div><div class="ps-screen">' + inner + '</div><div class="ps-island"></div></div></div>';
`;

export const PHONE_DEVICE_CSS = String.raw`
.ps-device {
  position: absolute;
  inset: 0;
  font-size: calc(var(--ps-w) / 100);
  transform-style: preserve-3d;
}

.ps-back,
.ps-body {
  position: absolute;
  inset: 0;
  border-radius: 16.5em;
}

.ps-back {
  background: var(--ps-rim-dark);
  transform: translateZ(-4.5em);
  box-shadow: 0 6em 14em rgba(0, 0, 0, var(--ps-shadow)), 0 2em 4em rgba(0, 0, 0, calc(var(--ps-shadow) * 0.6));
}

.ps-body {
  background: var(--ps-rim);
  box-shadow: inset 0 0 0 0.35em rgba(255, 255, 255, 0.35), inset 0 0 0 0.9em rgba(0, 0, 0, 0.12);
}

.ps-key {
  position: absolute;
  width: 1.2em;
  border-radius: 9999px;
  background: var(--ps-rim-dark);
}

.ps-bezel {
  position: absolute;
  inset: 1.3em;
  border-radius: 15.2em;
  background: #050505;
  box-shadow: inset 0 0 0 0.25em rgba(255, 255, 255, 0.06);
}

.ps-screen {
  position: absolute;
  inset: 3.6em;
  overflow: hidden;
  border-radius: 12.9em;
  background: #000;
}

.ps-screen img,
.ps-screen video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.ps-island {
  position: absolute;
  left: 50%;
  top: 2.6em;
  width: 27em;
  height: 7.8em;
  margin-left: -13.5em;
  border-radius: 9999px;
  background: #000;
}

.ps-glare {
  position: absolute;
  inset: 0;
  background: linear-gradient(118deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0) 38%);
  pointer-events: none;
}
`;
