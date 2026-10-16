import { MEDIA_LIST } from '../media-list';
import { MEDIA_SLOT } from '../soft-settle';

export const FR_VIEW = String.raw`
${MEDIA_LIST}
${MEDIA_SLOT}
const MAX_FRAME_HEIGHT = 0.8;

root.insertAdjacentHTML('beforeend', '<div class="fr"><div class="fr-back"></div><div class="fr-window"></div><div class="fr-meta"><span class="fr-label"></span><span class="fr-count"></span></div></div>');

const scene = root.querySelector('.fr');
const backHost = root.querySelector('.fr-back');
const windowHost = root.querySelector('.fr-window');
const label = root.querySelector('.fr-label');
const counter = root.querySelector('.fr-count');

let cache = { buildKey: '', backs: [], fronts: [], boxKey: '', box: null, lookKey: '', shownIndex: -1 };

const sizeOf = () => ({ width: scene.clientWidth || 1080, height: scene.clientHeight || 1920 });
const pad = (n) => String(n).padStart(2, '0');

const buildLayer = (host, item, className) => {
  const layer = make(host, 'div', 'fr-layer ' + className);
  const inner = make(layer, 'div', 'fr-inner');
  const video = mountMedia(inner, item);
  return { layer, inner, video };
};

const build = (p, n) => {
  const key = JSON.stringify([p.media, n]);
  if (key === cache.buildKey) {
    return;
  }
  const items = mediaList(p.media);
  const pick = (k) => (items.length ? items[k % items.length] : null);
  backHost.innerHTML = '';
  windowHost.innerHTML = '';
  const backs = Array.from({ length: n }, (_, k) => buildLayer(backHost, pick(2 * k), 'fr-mono'));
  const fronts = Array.from({ length: n }, (_, k) => buildLayer(windowHost, pick(2 * k + 1), 'fr-colour'));
  cache = { ...cache, buildKey: key, backs, fronts, shownIndex: -1 };
};

const frameBox = (p, width, height) => {
  const key = JSON.stringify([width, height, p.frameWidth, p.frameRatio]);
  if (key !== cache.boxKey) {
    const w = width * p.frameWidth;
    const h = Math.min(w * p.frameRatio, height * MAX_FRAME_HEIGHT);
    const s = windowHost.style;
    s.width = w + 'px';
    s.height = h + 'px';
    s.left = (width - w) / 2 + 'px';
    s.top = (height - h) / 2 + 'px';
    cache = { ...cache, boxKey: key, box: { w, h } };
  }
  return cache.box;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.backEmpty, p.frontEmpty, p.mono, p.labelColor, p.font, p.weight, p.tracking, p.label]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--fr-bg', p.background);
  s.setProperty('--fr-back-empty', p.backEmpty);
  s.setProperty('--fr-front-empty', p.frontEmpty);
  s.setProperty('--fr-mono', p.mono ? 'grayscale(1) contrast(1.08)' : 'none');
  s.setProperty('--fr-ink', p.labelColor);
  s.setProperty('--fr-font', fontOf(p.font));
  s.setProperty('--fr-weight', String(p.weight));
  s.setProperty('--fr-tracking', p.tracking + 'em');
  label.textContent = p.label;
};

const paintLayer = (node, l, w, h, offsetX, offsetY) => {
  node.layer.style.visibility = l.shown ? 'visible' : 'hidden';
  if (!l.shown) {
    return;
  }
  node.layer.style.zIndex = String(l.z);
  node.layer.style.opacity = String(l.opacity);
  node.layer.style.transform = 'translate3d(' + (l.cx * w + offsetX) + 'px, ' + (l.cy * h + offsetY) + 'px, 0) scale(' + l.grow + ')';
  node.inner.style.transform = 'translate3d(' + l.ix * w + 'px, ' + l.iy * h + 'px, 0) scale(' + l.scale + ')';
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  paintLook(p);
  const f = revealFrame(p, t, duration);
  build(p, f.n);
  const box = frameBox(p, width, height);
  const unit = Math.min(width, height);

  f.back.forEach((l, k) => paintLayer(cache.backs[k], l, width, height, f.backX * unit, f.backY * unit));
  f.front.forEach((l, k) => paintLayer(cache.fronts[k], l, box.w, box.h, 0, 0));
  windowHost.style.transform = 'translate3d(' + f.frameX * unit + 'px, ' + f.frameY * unit + 'px, 0)';
  [...cache.backs, ...cache.fronts].forEach((node) => seekVideo(node.video, t));

  scene.style.setProperty('--fr-size', (p.labelSize / 100) * unit + 'px');
  if (f.current !== cache.shownIndex) {
    cache.shownIndex = f.current;
    counter.textContent = p.counter ? pad(f.current + 1) + ' / ' + pad(f.n) : '';
  }
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
