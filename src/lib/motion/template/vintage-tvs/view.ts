import { MEDIA_LIST } from '../media-list';

export const TVS_VIEW = String.raw`
${MEDIA_LIST}
const NOISE_W = 160;
const NOISE_H = 120;
const NOISE_HZ = 60;
const GRAIN = 0.07;
const HERO_NOISE = 4;
const SCAN_LINES = 150;
const MAP_SIZE = 64;
const BEND = 0.25;
const BEND_SCALE = 0.14;
const FRINGE_SHIFT = 0.006;
const FLICKER_MAX = 0.07;
const SCAN_MAX = 0.6;
const HALO = 1.9;
const HALO_MAX = 0.32;
const ROOM_LIGHT = 0.55;
const LEG_W = 0.035;
const DOME_W = 0.16;
const ROD_TILT = 28;

root.insertAdjacentHTML('beforeend', '<div class="vt"><svg class="vt-defs"></svg><div class="vt-wall"></div><i class="vt-light"></i><i class="vt-shade"></i></div>');

const scene = root.querySelector('.vt');
const defs = root.querySelector('.vt-defs');
const wall = root.querySelector('.vt-wall');
const light = root.querySelector('.vt-light');

let cache = { layoutKey: '', layout: null, buildKey: '', sets: [], filterKey: '', lookKey: '', titleKey: '', words: [] };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });
const px = (v) => v + 'px';

const el = (parent, tag, className) => {
  const node = document.createElement(tag);
  node.className = className;
  parent.appendChild(node);
  return node;
};

const place = (node, x, y, w, h) => {
  const s = node.style;
  s.left = px(x);
  s.top = px(y);
  s.width = px(w);
  s.height = px(h);
};

const layoutFor = (p) => {
  const key = JSON.stringify([p.count]);
  if (key !== cache.layoutKey) {
    cache = { ...cache, layoutKey: key, layout: tvLayout(p) };
  }
  return cache.layout;
};

const bendMap = () => {
  const canvas = document.createElement('canvas');
  canvas.width = MAP_SIZE;
  canvas.height = MAP_SIZE;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(MAP_SIZE, MAP_SIZE);
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const u = (x + 0.5) / MAP_SIZE - 0.5;
      const v = (y + 0.5) / MAP_SIZE - 0.5;
      const reach = 1 - Math.min(1, 4 * (u * u + v * v));
      const k = (y * MAP_SIZE + x) * 4;
      image.data[k] = Math.round(255 * clamp01(0.5 - (BEND * u * reach) / BEND_SCALE));
      image.data[k + 1] = Math.round(255 * clamp01(0.5 - (BEND * v * reach) / BEND_SCALE));
      image.data[k + 2] = 128;
      image.data[k + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
};

const channelMatrix = (r, g, b) => r + ' 0 0 0 0  0 ' + g + ' 0 0 0  0 0 ' + b + ' 0 0  0 0 0 1 0';

const filterFor = (p) => {
  const bend = (BEND_SCALE * p.curvature).toFixed(4);
  const shift = (FRINGE_SHIFT * p.fringe).toFixed(4);
  const id = 'vt-crt-' + bend.replace('.', '') + '-' + shift.replace('.', '');
  if (id === cache.filterKey) {
    return id;
  }
  defs.innerHTML = '<filter id="' + id + '" x="0" y="0" width="1" height="1" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">' +
    '<feImage href="' + bendMap() + '" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map"/>' +
    '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + bend + '" xChannelSelector="R" yChannelSelector="G" result="bent"/>' +
    '<feColorMatrix in="bent" type="matrix" values="' + channelMatrix(1, 0, 0) + '" result="red"/>' +
    '<feOffset in="red" dx="' + shift + '" result="redShift"/>' +
    '<feColorMatrix in="bent" type="matrix" values="' + channelMatrix(0, 1, 0) + '" result="green"/>' +
    '<feColorMatrix in="bent" type="matrix" values="' + channelMatrix(0, 0, 1) + '" result="blue"/>' +
    '<feOffset in="blue" dx="-' + shift + '" result="blueShift"/>' +
    '<feBlend in="redShift" in2="green" mode="screen" result="redGreen"/>' +
    '<feBlend in="redGreen" in2="blueShift" mode="screen"/>' +
    '</filter>';
  cache = { ...cache, filterKey: id };
  return id;
};

const slideHtml = (item) => {
  if (!item) {
    return '';
  }
  return item.video ? '<video muted playsinline preload="auto" src="' + item.src + '"></video>' : '<img decoding="sync" src="' + item.src + '">';
};

const buildPanel = (cabinet, tv, fit) => {
  const panel = el(cabinet, 'div', 'vt-panel vt-panel-' + tv.panel);
  const side = tv.panel === 'side';
  const x = side ? (tv.screen.x - tv.x + tv.screen.w) * fit : 0;
  const y = side ? 0 : (tv.screen.y - tv.y + tv.screen.h) * fit;
  const w = tv.w * fit - x;
  const h = tv.h * fit - y;
  place(panel, x, y, w, h);
  const knob = Math.min(w, h) * (side ? 0.32 : 0.5);
  const grille = el(panel, 'i', 'vt-grille');
  grille.style.width = px(side ? w * 0.5 : w * 0.45);
  grille.style.height = px(side ? h * 0.32 : h * 0.42);
  [0, 1].forEach(() => {
    const k = el(panel, 'i', 'vt-knob');
    k.style.width = px(knob);
    k.style.height = px(knob);
  });
};

const buildExtras = (cabinet, tv, fit) => {
  if (tv.legs) {
    [0.1, 0.9 - LEG_W].forEach((at) => place(el(cabinet, 'i', 'vt-leg'), tv.w * at * fit, tv.h * fit, LEG_W * fit, tv.b * fit));
  }
  if (!tv.antenna) {
    return;
  }
  const domeW = DOME_W * tv.w * fit;
  const domeH = domeW * 0.45;
  place(el(cabinet, 'i', 'vt-dome'), (tv.w * fit - domeW) / 2, -domeH, domeW, domeH);
  [-ROD_TILT, ROD_TILT * 0.8].forEach((tilt) => {
    const rod = el(cabinet, 'i', 'vt-rod');
    place(rod, tv.w * fit / 2 - 1, -domeH - 0.12 * fit + domeH * 0.3, 2, 0.12 * fit);
    rod.style.transform = 'rotate(' + tilt + 'deg)';
  });
};

const buildSet = (tv, p, fit, items, hero) => {
  const cabinet = el(wall, 'div', 'vt-tv vt-' + tv.finish);
  place(cabinet, tv.x * fit, tv.y * fit, tv.w * fit, tv.h * fit);
  cabinet.style.fontSize = px(tv.h * fit * 0.06);
  const sx = (tv.screen.x - tv.x) * fit;
  const sy = (tv.screen.y - tv.y) * fit;
  const sw = tv.screen.w * fit;
  const sh = tv.screen.h * fit;
  const rim = tv.h * fit * 0.025;
  place(el(cabinet, 'i', 'vt-bezel'), sx - rim, sy - rim, sw + 2 * rim, sh + 2 * rim);
  const screen = el(cabinet, 'div', 'vt-screen');
  place(screen, sx, sy, sw, sh);
  const picture = el(screen, 'div', 'vt-picture');
  const media = el(picture, 'div', 'vt-media');
  const slides = Array.from({ length: channelCount(p, tv) }, (_, k) => {
    const slide = el(media, 'div', 'vt-slide');
    slide.innerHTML = slideHtml(items.length ? items[(tv.i + k * cache.layout.tvs.length) % items.length] : null);
    const video = slide.querySelector('video');
    if (video) {
      video.addEventListener('loadedmetadata', () => seekVideo(video, tl.time()));
    }
    return { node: slide, video };
  });
  const card = tv.i === hero ? el(picture, 'div', 'vt-card') : null;
  const headline = card ? el(card, 'h1', 'vt-headline') : null;
  const noise = el(picture, 'canvas', 'vt-noise');
  const detail = tv.i === hero ? HERO_NOISE : 1;
  noise.width = NOISE_W * detail;
  noise.height = NOISE_H * detail;
  const scan = el(picture, 'i', 'vt-scan');
  scan.style.backgroundSize = '100% ' + px(sh / SCAN_LINES);
  const roll = el(picture, 'i', 'vt-roll');
  const flick = el(picture, 'i', 'vt-flick');
  const flash = el(picture, 'i', 'vt-flash');
  el(screen, 'i', 'vt-glass');
  const halo = el(wall, 'i', 'vt-halo');
  const hw = sw * HALO;
  const hh = sh * HALO;
  place(halo, (tv.screen.x + tv.screen.w / 2) * fit - hw / 2, (tv.screen.y + tv.screen.h / 2) * fit - hh / 2, hw, hh);
  wall.insertBefore(halo, wall.firstChild);
  buildPanel(cabinet, tv, fit);
  buildExtras(cabinet, tv, fit);
  const lit = el(cabinet, 'i', 'vt-lit');
  return { tv, picture, media, slides, card, headline, noise, noiseSeed: -1, scan, roll, flick, flash, halo, lit };
};

const buildWall = (p, layout, fit) => {
  const key = JSON.stringify([p.media, p.count, fit, p.firstSwitch, p.channelSeconds, p.pushAt]);
  if (key === cache.buildKey) {
    return cache.sets;
  }
  const items = mediaList(p.media);
  wall.innerHTML = '';
  wall.style.width = px(layout.width * fit);
  wall.style.height = px(layout.height * fit);
  const floor = el(wall, 'i', 'vt-floor');
  floor.style.top = px(layout.height * fit);
  const sets = layout.tvs.map((tv) => buildSet(tv, p, fit, items, layout.hero));
  cache = { ...cache, buildKey: key, sets, titleKey: '' };
  return sets;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.titleColor, p.glowColor, p.placeholderColor, p.font, p.fontWeight, p.tracking]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--vt-room', p.background);
  s.setProperty('--vt-ink', p.titleColor);
  s.setProperty('--vt-glow', p.glowColor);
  s.setProperty('--vt-empty', p.placeholderColor);
  s.setProperty('--vt-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
  s.setProperty('--vt-weight', String(p.fontWeight));
  s.setProperty('--vt-tracking', p.tracking + 'em');
};

const paintTitle = (p, headline) => {
  const key = JSON.stringify([p.title, p.lowercase]);
  if (!headline || key === cache.titleKey) {
    return cache.words;
  }
  const words = titleWords(p.title);
  headline.innerHTML = '';
  const nodes = words.map((word, i) => {
    const span = el(headline, 'span', 'vt-word');
    span.textContent = (p.lowercase ? word.toLowerCase() : word) + (i < words.length - 1 ? ' ' : '');
    return span;
  });
  cache = { ...cache, titleKey: key, words: nodes };
  return nodes;
};

const paintNoise = (set, seed) => {
  if (set.noiseSeed === seed) {
    return;
  }
  set.noiseSeed = seed;
  const ctx = set.noise.getContext('2d');
  const image = ctx.createImageData(set.noise.width, set.noise.height);
  let state = (seed * 2654435761 + set.tv.i * 40503) >>> 0;
  for (let k = 0; k < image.data.length; k += 4) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const v = state >>> 24;
    image.data[k] = v;
    image.data[k + 1] = v;
    image.data[k + 2] = v;
    image.data[k + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
};

const paintSet = (set, s, p, t, filter) => {
  set.picture.style.transform = 'scale(' + s.sx + ', ' + s.sy + ')';
  set.picture.style.visibility = s.sx > 0.001 ? 'visible' : 'hidden';
  set.media.style.filter = p.curvature > 0 || p.fringe > 0 ? 'url(#' + filter + ')' : 'none';
  set.slides.forEach((slide, k) => {
    const shown = !s.card && k === Math.min(s.channel, set.slides.length - 1);
    slide.node.style.visibility = shown ? 'visible' : 'hidden';
    if (shown) {
      seekVideo(slide.video, t);
    }
  });
  if (set.card) {
    set.card.style.visibility = s.card ? 'visible' : 'hidden';
  }
  set.noise.style.opacity = String(Math.max(s.noise, GRAIN));
  paintNoise(set, Math.floor(t * NOISE_HZ));
  set.scan.style.opacity = String(SCAN_MAX * p.scanlines);
  set.roll.style.transform = 'translateY(' + (s.roll * 400 - 100) + '%)';
  set.roll.style.opacity = String(p.flicker * 2);
  set.flick.style.opacity = String(s.card ? 0 : FLICKER_MAX * p.flicker * s.flicker * s.power);
  set.flash.style.opacity = String(s.flash);
  set.halo.style.opacity = String(HALO_MAX * Math.max(s.power, s.flash * 0.6));
  set.lit.style.opacity = String(0.5 * s.power);
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  const layout = layoutFor(p);
  const f = tvFrame(layout, p, t, duration, width, height);
  const sets = buildWall(p, layout, f.fit);
  paintLook(p);
  const hero = sets[layout.hero];
  const words = paintTitle(p, hero.headline);
  const filter = filterFor(p);

  wall.style.transform = 'translate(' + px(width / 2) + ', ' + px(height / 2) + ') scale(' + f.scale + ') translate(' + px(-f.fx * f.fit) + ', ' + px(-f.fy * f.fit) + ')';
  sets.forEach((set, i) => paintSet(set, f.screens[i], p, t, filter));
  const lit = f.screens.reduce((sum, s) => sum + s.power, 0) / Math.max(1, f.screens.length);
  light.style.opacity = String(ROOM_LIGHT * lit);

  const unit = Math.min(width, height);
  hero.headline.style.fontSize = px((p.fontSize / 100) * unit / f.zoomIn);
  hero.headline.style.maxWidth = px((width * 0.86) / f.zoomIn);
  f.words.forEach((w, i) => {
    const s = words[i].style;
    s.opacity = String(w.opacity);
    s.transform = 'translate3d(0, ' + w.y + 'em, 0)';
  });
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
