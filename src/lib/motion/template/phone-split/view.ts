import { MEDIA_LIST } from '../media-list';

export const PHONE_VIEW = String.raw`
${MEDIA_LIST}
const FINISHES = {
  natural: ['linear-gradient(90deg, #77736d 0%, #cfccc5 4%, #a19d96 12%, #dedbd5 48%, #9a968f 88%, #d2cfc8 96%, #6f6b65 100%)', '#6b6863'],
  black: ['linear-gradient(90deg, #1c1c1e 0%, #6b6b70 4%, #303033 12%, #4a4a4e 48%, #2a2a2d 88%, #626267 96%, #18181a 100%)', '#202022'],
  white: ['linear-gradient(90deg, #b9b8b4 0%, #f7f6f3 4%, #dcdbd7 12%, #f2f1ee 48%, #d4d3cf 88%, #f5f4f1 96%, #aeada9 100%)', '#bdbcb8'],
  desert: ['linear-gradient(90deg, #8c7865 0%, #e3cfb9 4%, #b9a28b 12%, #dcc7b0 48%, #ae9780 88%, #e0ccb5 96%, #85715f 100%)', '#8f7b68']
};
const KEYS = [['left', 19, 6], ['left', 27, 11], ['left', 39.5, 11], ['right', 31, 17]];
const SCREEN_UI = '<div class="ps-ui"><div class="ps-status"><span>9:41</span><span class="ps-dots"><i></i><i></i><i></i></span></div><div class="ps-kicker">friday, 12</div><div class="ps-title">today</div><div class="ps-hero"></div><div class="ps-row"><i></i><span><b></b><s></s></span></div><div class="ps-row"><i></i><span><b></b><s></s></span></div></div>';
const KEY_SHIFT = '-0.75em';

const keyHtml = ([side, top, length]) => '<span class="ps-key" style="' + side + ':' + KEY_SHIFT + ';top:' + top + '%;height:' + length + '%;transform:translateZ(-2.2em)"></span>';

root.insertAdjacentHTML('beforeend', '<div class="ps"><div class="ps-phone"><div class="ps-device">' + KEYS.map(keyHtml).join('') + '<div class="ps-back"></div><div class="ps-body"><div class="ps-bezel"></div><div class="ps-screen"></div><div class="ps-island"></div></div></div></div><div class="ps-half ps-left"></div><div class="ps-half ps-right"></div><span class="ps-half ps-probe"> </span></div>');

const scene = root.querySelector('.ps');
const phone = root.querySelector('.ps-phone');
const screen = root.querySelector('.ps-screen');
const halves = { left: root.querySelector('.ps-left'), right: root.querySelector('.ps-right') };
const probe = root.querySelector('.ps-probe');

let cache = { wordsKey: '', words: [], mediaKey: null, video: null, lookKey: '', measureKey: '', layout: null };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });
const fontsReady = () => (document.fonts ? document.fonts.status : 'loaded');
const fontOf = (p) => (String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');

const fillHalf = (node, words, p) => {
  node.innerHTML = '';
  return words.map((word, i) => {
    const span = document.createElement('span');
    span.className = 'ps-word';
    span.textContent = (p.lowercase ? word.toLowerCase() : word) + (i < words.length - 1 ? ' ' : '');
    node.appendChild(span);
    return span;
  });
};

const buildWords = (p) => {
  const key = JSON.stringify([p.headline, p.splitAt, p.lowercase]);
  if (key === cache.wordsKey) {
    return cache.words;
  }
  const parts = splitWords(p.headline, p.splitAt);
  const words = [...fillHalf(halves.left, parts.left, p), ...fillHalf(halves.right, parts.right, p)];
  cache = { ...cache, wordsKey: key, words, measureKey: '' };
  return words;
};

const buildScreen = (p) => {
  const key = JSON.stringify(p.media || '');
  if (key === cache.mediaKey) {
    return;
  }
  const item = mediaList(p.media)[0];
  const media = item ? (item.video ? '<video muted playsinline preload="auto" src="' + item.src + '"></video>' : '<img decoding="sync" src="' + item.src + '">') : SCREEN_UI;
  screen.innerHTML = media + '<div class="ps-glare"></div>';
  cache = { ...cache, mediaKey: key, video: screen.querySelector('video') };
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.textColor, p.font, p.fontWeight, p.tracking, p.finish, p.shadow, p.screenAccent]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key, measureKey: '' };
  const finish = FINISHES[p.finish] || FINISHES.natural;
  const s = scene.style;
  s.setProperty('--ps-bg', p.background);
  s.setProperty('--ps-ink', p.textColor);
  s.setProperty('--ps-font', fontOf(p));
  s.setProperty('--ps-weight', String(p.fontWeight));
  s.setProperty('--ps-tracking', p.tracking + 'em');
  s.setProperty('--ps-rim', finish[0]);
  s.setProperty('--ps-rim-dark', finish[1]);
  s.setProperty('--ps-shadow', String(p.shadow));
  s.setProperty('--ps-accent', p.screenAccent);
};

const measure = (p) => {
  const { width, height } = sizeOf();
  const px = (p.fontSize * Math.min(width, height)) / 100;
  const key = JSON.stringify([width, height, px, cache.wordsKey, cache.lookKey, p.phoneHeight, p.gap, p.stack, fontsReady()]);
  if (key === cache.measureKey) {
    return cache.layout;
  }
  scene.style.setProperty('--ps-px', px + 'px');
  const em = (node) => node.getBoundingClientRect().width / px;
  const layout = phoneLayout(p, { leftW: em(halves.left), rightW: em(halves.right), space: em(probe), frameW: width / px, frameH: height / px });
  scene.style.setProperty('--ps-px', px * layout.fit + 'px');
  scene.style.setProperty('--ps-w', layout.phoneW + 'em');
  scene.style.setProperty('--ps-h', layout.phoneH + 'em');
  cache = { ...cache, measureKey: key, layout };
  return layout;
};

const placeHalves = (layout, f) => {
  if (layout.axis === 'row') {
    halves.left.style.transform = 'translate(calc(-100% + ' + f.left.x + 'em), -50%)';
    halves.right.style.transform = 'translate(' + f.right.x + 'em, -50%)';
    return;
  }
  halves.left.style.transform = 'translate(-50%, calc(-50% + ' + f.left.y + 'em))';
  halves.right.style.transform = 'translate(-50%, calc(-50% + ' + f.right.y + 'em))';
};

const placePhone = (f) => {
  phone.style.transform = 'translate(-50%, -50%) translate(' + f.phone.x + 'em, ' + f.phone.y + 'em) rotateX(' + f.phone.tilt + 'deg)';
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const words = buildWords(p);
  buildScreen(p);
  paintLook(p);
  const layout = measure(p);
  const f = phoneFrame(layout, p, t, duration, words.length);

  placeHalves(layout, f);
  placePhone(f);
  seekVideo(cache.video, t);
  f.words.forEach((w, i) => {
    words[i].style.opacity = String(w.opacity);
    words[i].style.transform = 'translateY(' + w.rise + 'em)';
  });
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
