const LOOP_SECONDS = 9;
const SIZE_FROM = 64;
const SIZE_TO = 88;
const CODE_HEIGHT = 214;
const PRESS_SCALE = 0.84;

const bezier = (x1, y1, x2, y2) => (p) => {
  const at = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (at(x1, x2, mid) < p) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return at(y1, y2, (lo + hi) / 2);
};

const expo = bezier(0.85, 0, 0.12, 1);
const clamp = (v) => Math.min(1, Math.max(0, v));
const span = (t, from, to) => expo(clamp((t - from) / (to - from)));
const mix = (a, b, p) => a + (b - a) * p;

const BEATS = {
  titleOut: [1.7, 2.4],
  windowIn: [1.8, 2.6],
  cursorIn: [2.4, 2.7],
  toHero: [2.6, 3.4],
  heroClick: [3.45, 3.65],
  ripple: [3.5, 4.1],
  toSize: [4.2, 5.0],
  sizeClick: [5.05, 5.25],
  grow: [5.25, 6.0],
  cursorOut: [6.1, 6.4],
  codeIn: [6.3, 7.1],
  addLine: [7.2, 7.8],
  windowOut: [8.2, 8.8],
  titleIn: [8.35, 9.0]
};

const $ = (s) => document.querySelector(s);
const center = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width * 0.42, y: r.top + r.height * 0.55 };
};

const press = (t, [from, to]) => {
  if (t < from || t > to) {
    return 1;
  }
  const p = (t - from) / (to - from);
  return mix(1, PRESS_SCALE, Math.sin(p * Math.PI));
};

window.renderAt = (t) => {
  const b = Object.fromEntries(Object.entries(BEATS).map(([k, [from, to]]) => [k, span(t, from, to)]));

  const titleShown = t < 5 ? 1 - b.titleOut : b.titleIn;
  const titleShift = t < 5 ? -50 * b.titleOut : 50 * (1 - b.titleIn);
  const title = $('.titlecard');
  title.style.opacity = titleShown;
  title.style.transform = `translateY(${titleShift}px)`;

  const windowShown = t < 5 ? b.windowIn : 1 - b.windowOut;
  const windowShift = t < 5 ? 70 * (1 - b.windowIn) : -50 * b.windowOut;
  const win = $('.window');
  win.style.opacity = windowShown;
  win.style.transform = `translateY(${windowShift}px) scale(${mix(0.96, 1, t < 5 ? b.windowIn : 1)})`;

  const hero = $('.hero');
  hero.style.fontSize = `${mix(SIZE_FROM, SIZE_TO, b.grow)}px`;
  const heroBox = hero.getBoundingClientRect();
  const canvasBox = $('.canvas').getBoundingClientRect();
  const scale = canvasBox.width / $('.canvas').offsetWidth;
  $('.lede').style.top = `${hero.offsetTop + hero.offsetHeight + 34}px`;

  const sel = $('.sel');
  sel.style.left = `${hero.offsetLeft - 8}px`;
  sel.style.top = `${hero.offsetTop - 6}px`;
  sel.style.width = `${hero.offsetWidth + 16}px`;
  sel.style.height = `${hero.offsetHeight + 12}px`;
  sel.style.opacity = t >= BEATS.heroClick[0] + 0.05 ? 1 : 0;

  const size = $('#size');
  size.classList.toggle('focus', t >= BEATS.sizeClick[0] + 0.05);
  $('#from').style.transform = `translateY(${-30 * b.grow}px)`;
  $('#from').style.opacity = 1 - b.grow;
  $('#to').style.transform = `translateY(${30 * (1 - b.grow)}px)`;
  $('#to').style.opacity = b.grow;

  const code = $('.code');
  code.style.top = `${$('.canvas').offsetHeight - CODE_HEIGHT * b.codeIn}px`;
  const add = $('.line.add');
  add.style.clipPath = `inset(0 ${100 * (1 - b.addLine)}% 0 0)`;

  const start = { x: 1010, y: 600 };
  const heroAt = { x: heroBox.left + Math.min(heroBox.width, 360) * 0.55, y: heroBox.top + 40 * scale };
  const sizeAt = center(size);
  const leg = t < BEATS.toSize[0] ? b.toHero : 1;
  let x = mix(start.x, heroAt.x, leg);
  let y = mix(start.y, heroAt.y, leg);
  x = mix(x, sizeAt.x, b.toSize);
  y = mix(y, sizeAt.y, b.toSize);

  const cursor = $('.cursor');
  const cursorShown = b.cursorIn * (1 - b.cursorOut) * windowShown;
  const pressed = press(t, BEATS.heroClick) * press(t, BEATS.sizeClick);
  cursor.style.opacity = cursorShown;
  cursor.style.transform = `translate(${x - 4}px, ${y - 2}px) scale(${pressed})`;

  const ripple = $('.ripple');
  const r = clamp((t - BEATS.ripple[0]) / (BEATS.ripple[1] - BEATS.ripple[0]));
  const rippleOut = 1 - Math.pow(1 - r, 3);
  ripple.style.left = `${heroAt.x}px`;
  ripple.style.top = `${heroAt.y}px`;
  ripple.style.opacity = r > 0 && r < 1 ? 0.6 * (1 - rippleOut) : 0;
  ripple.style.transform = `scale(${mix(0.3, 1.6, rippleOut)})`;
};

window.LOOP_SECONDS = LOOP_SECONDS;
