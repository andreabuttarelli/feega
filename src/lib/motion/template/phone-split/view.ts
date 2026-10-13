import { MEDIA_LIST } from '../media-list';
import { PHONE_DEVICE } from '../phone-device';

export const PHONE_VIEW = String.raw`
${MEDIA_LIST}
${PHONE_DEVICE}
const SCREEN_UI = '<div class="ps-ui"><div class="ps-status"><span>9:41</span><span class="ps-dots"><i></i><i></i><i></i></span></div><div class="ps-kicker">friday, 12</div><div class="ps-title">today</div><div class="ps-hero"></div><div class="ps-row"><i></i><span><b></b><s></s></span></div><div class="ps-row"><i></i><span><b></b><s></s></span></div></div>';

root.insertAdjacentHTML('beforeend', '<div class="ps"><div class="ps-phone">' + deviceHtml('') + '</div><div class="ps-half ps-left"></div><div class="ps-half ps-right"></div><span class="ps-half ps-probe"> </span></div>');

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
