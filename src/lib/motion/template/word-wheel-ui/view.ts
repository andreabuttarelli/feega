import { MEDIA_LIST } from '../media-list';

export const WHEEL_VIEW = String.raw`
${MEDIA_LIST}
const MIN_WORDS = 3;
const DRUM_DEGREES = 20;
const PERSPECTIVE = 2.4;
const OFFSTAGE = 0.35;
const GLOW_EM = 0.32;
const LIFT_EM = 0.5;
const CHEVRON_UP = '<svg viewBox="0 0 12 12"><path d="M3 7.5l3-3 3 3" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
const CHEVRON_DOWN = '<svg viewBox="0 0 12 12"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
const LOGO_SVG = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="var(--ww-accent)" stroke-width="2.4"/><circle cx="12" cy="12" r="4" fill="var(--ww-accent)"/></svg>';

root.insertAdjacentHTML('beforeend', '<div class="ww"><div class="ww-glow"></div><div class="ww-stage"><div class="ww-panel"></div></div><div class="ww-text"><span class="ww-lead"></span><div class="ww-wheel"></div></div><span class="ww-text ww-measure"></span></div>');

const scene = root.querySelector('.ww');
const glow = root.querySelector('.ww-glow');
const stage = root.querySelector('.ww-stage');
const panel = root.querySelector('.ww-panel');
const textBox = root.querySelector('.ww-text');
const lead = root.querySelector('.ww-lead');
const wheel = root.querySelector('.ww-wheel');
const measure = root.querySelector('.ww-measure');

let cache = { lookKey: '', wordsKey: '', words: [], nodes: [], panelKey: '', video: null, screens: [], marks: [], measureKey: '', measured: null };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });
const fontsReady = () => (document.fonts ? document.fonts.status : 'loaded');
const listOf = (raw) => String(raw || '').split(',').map((s) => s.trim()).filter(Boolean);
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const hexRgb = (hex) => {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
};

const mixRgb = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.accent, p.textColor, p.font]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--ww-bg', p.background);
  s.setProperty('--ww-accent', p.accent);
  s.setProperty('--ww-ink', p.textColor);
  s.setProperty('--ww-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", "Helvetica Neue", Helvetica, Arial, sans-serif');
};

const paintWords = (p) => {
  const key = JSON.stringify([p.lead, p.features]);
  if (key === cache.wordsKey) {
    return cache.words;
  }
  const given = featuresOf(p.features).map((f) => f.word);
  const base = given.length ? given : [' '];
  const words = Array.from({ length: Math.max(MIN_WORDS, Math.ceil(MIN_WORDS / base.length) * base.length) }, (_, i) => base[i % base.length]);
  lead.textContent = p.lead;
  wheel.innerHTML = '';
  const nodes = words.map((word) => {
    const node = document.createElement('span');
    node.className = 'ww-word';
    node.textContent = word;
    wheel.appendChild(node);
    return node;
  });
  cache = { ...cache, wordsKey: key, words, nodes };
  return words;
};

const featuresOf = (raw) => String(raw || '').split('\n').map((line) => line.split('|').map((part) => part.trim())).filter((parts) => parts[0]).map(([word, title, items]) => ({ word, title: title || word, items: listOf(items) }));

const ITEMS_SHOWN = 3;
const BAR_HEIGHTS = [0.42, 0.66, 0.54, 0.88];
const SCREEN_SHIFT = 0.06;

const itemsOf = (f) => Array.from({ length: ITEMS_SHOWN }, (_, i) => f.items[i] ?? f.items[i % Math.max(1, f.items.length)] ?? '');

const tilesHtml = (f) => '<div class="ww-tiles">' + itemsOf(f).map((item) => '<div class="ww-tile"><b></b>' + escapeHtml(item) + '</div>').join('') + '</div>';
const togglesHtml = (f) => itemsOf(f).map((item, i) => '<div class="ww-toggle">' + escapeHtml(item) + '<span class="ww-switch' + (i < 2 ? ' is-on' : '') + '"></span></div>').join('');
const chartHtml = (f) => '<div class="ww-chart">' + [...itemsOf(f), ''].map((item, i) => '<div class="ww-bar"><b style="height:' + BAR_HEIGHTS[i] * 100 + '%"></b>' + escapeHtml(item) + '</div>').join('') + '</div>';
const SCREEN_BODIES = [tilesHtml, togglesHtml, chartHtml];

const screenHtml = (f, i) => '<div class="ww-screen"><div class="ww-card"><div class="ww-kicker">' + escapeHtml(f.word) + '</div><div class="ww-head">' + escapeHtml(f.title) + '</div></div>' + SCREEN_BODIES[i % SCREEN_BODIES.length](f) + '</div>';

const sideHtml = (p, features) => {
  const items = features.map((f) => '<div class="ww-item"><i></i>' + escapeHtml(f.word) + '</div>').join('');
  return '<div class="ww-side"><div class="ww-chip"><span class="ww-logo">' + LOGO_SVG + '</span><span class="ww-brand">' + escapeHtml(p.brand) + '</span><span class="ww-pill">v2.0</span></div>' +
    '<div class="ww-label">Features' + CHEVRON_UP + '</div>' + items +
    '<div class="ww-label">Settings' + CHEVRON_DOWN + '</div></div>';
};

const mainHtml = (p, features) => {
  const item = mediaList(p.media)[0];
  if (item) {
    return '<div class="ww-main">' + (item.video ? '<video class="ww-shot" muted playsinline preload="auto" src="' + item.src + '"></video>' : '<img class="ww-shot" decoding="sync" src="' + item.src + '">') + '</div>';
  }
  return '<div class="ww-main"><div class="ww-hello">Welcome back<br><b>' + escapeHtml(p.brand) + '</b></div>' +
    '<div class="ww-screens">' + features.map(screenHtml).join('') + '</div></div>';
};

const paintPanel = (p) => {
  const key = JSON.stringify([p.brand, p.features, p.media]);
  if (key === cache.panelKey) {
    return;
  }
  const features = featuresOf(p.features);
  panel.innerHTML = '<div class="ww-ui">' + sideHtml(p, features) + mainHtml(p, features) + '</div><div class="ww-shade"></div>';
  const video = panel.querySelector('video');
  if (video) {
    video.addEventListener('loadedmetadata', () => seekVideo(video, tl.time()));
  }
  cache = { ...cache, panelKey: key, video, screens: [...panel.querySelectorAll('.ww-screen')], marks: [...panel.querySelectorAll('.ww-item i')] };
};

const paintScreens = (screen) => {
  const n = cache.screens.length;
  const weight = (i) => (n && i === screen.from % n ? 1 - screen.mix : 0) + (n && i === screen.to % n ? screen.mix : 0);
  cache.screens.forEach((node, i) => {
    const w = weight(i);
    const offset = i === screen.to % n && i !== screen.from % n ? 1 - screen.mix : -screen.mix;
    node.style.opacity = String(w);
    node.style.visibility = w > 0.002 ? 'visible' : 'hidden';
    node.style.transform = 'translate3d(0, ' + offset * SCREEN_SHIFT * 100 + 'cqh, 0)';
  });
  cache.marks.forEach((node, i) => {
    node.style.opacity = String(weight(i));
  });
};

const measureText = (p, words) => {
  const key = JSON.stringify([p.lead, words, p.font, fontsReady()]);
  if (key === cache.measureKey) {
    return cache.measured;
  }
  const widthOf = (s) => {
    measure.textContent = s;
    return measure.offsetWidth / 100;
  };
  const measured = { leadW: widthOf(p.lead), wordW: Math.max(0.01, ...words.map(widthOf)) };
  cache = { ...cache, measureKey: key, measured };
  return measured;
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  const unit = Math.min(width, height);
  paintLook(p);
  paintPanel(p);
  const words = paintWords(p);
  const layout = wheelLayout(p, width, height, measureText(p, words));
  const f = wheelFrame(p, t, duration, words.length);
  const px = (x) => x * unit;
  const cx = width / 2;
  const cy = height / 2;
  const em = px(layout.em);

  glow.style.opacity = String(p.glow * (0.35 + 0.65 * f.glow));

  const box = layout.panel;
  const travel = px(layout.box.ax - box.x0 + OFFSTAGE) * f.panel.shift;
  stage.style.perspective = px(PERSPECTIVE) + 'px';
  stage.style.perspectiveOrigin = (cx + px(box.x0)) + 'px ' + (cy + px(box.y0 + box.h / 2)) + 'px';
  const ps = panel.style;
  ps.width = px(box.w) + 'px';
  ps.height = px(box.h) + 'px';
  ps.opacity = String(f.panel.opacity);
  ps.visibility = f.panel.opacity > 0.002 ? 'visible' : 'hidden';
  ps.transform = 'translate3d(' + (cx + px(box.x0) + travel) + 'px, ' + (cy + px(box.y0)) + 'px, 0) rotateY(' + f.panel.yaw + 'deg) rotateX(' + p.pitch + 'deg) rotateZ(' + p.roll + 'deg)';
  seekVideo(cache.video, t);
  paintScreens(f.screen);

  const text = layout.text;
  const ts = textBox.style;
  ts.fontSize = em + 'px';
  ts.transform = 'translate3d(' + (cx + px(text.x0)) + 'px, ' + (cy + px((text.y0 + text.y1) / 2) - em / 2) + 'px, 0)';
  lead.style.opacity = String(f.lead.opacity);
  lead.style.transform = 'translate3d(0, ' + f.lead.rise * LIFT_EM + 'em, 0)';
  wheel.style.transform = 'translate3d(' + (layout.em > 0 ? measureText(p, words).leadW + p.gap : 0) + 'em, ' + f.wheel.rise * LIFT_EM + 'em, 0)';

  const dim = hexRgb(p.dimColor);
  const lit = hexRgb(p.accent);
  const radius = ROW_PITCH / Math.sin((DRUM_DEGREES * Math.PI) / 180);
  f.words.forEach((w, i) => {
    const s = cache.nodes[i].style;
    const angle = w.offset * DRUM_DEGREES;
    const y = radius * Math.sin((angle * Math.PI) / 180);
    const z = radius * (Math.cos((angle * Math.PI) / 180) - 1);
    const rgb = mixRgb(dim, lit, w.focus);
    s.opacity = String(w.opacity);
    s.visibility = w.opacity > 0.002 ? 'visible' : 'hidden';
    s.color = 'rgb(' + rgb.join(',') + ')';
    s.textShadow = '0 0 ' + GLOW_EM + 'em rgba(' + lit.join(',') + ',' + (0.55 * p.glow * w.focus).toFixed(3) + ')';
    s.transform = 'translate3d(0, ' + y + 'em, ' + z + 'em) rotateX(' + -angle + 'deg)';
  });
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
