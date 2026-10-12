import { MEDIA_LIST } from '../media-list';

export const WHEEL_VIEW = String.raw`
${MEDIA_LIST}
const MIN_WORDS = 3;
const DRUM_DEGREES = 20;
const PERSPECTIVE = 2.4;
const OFFSTAGE = 0.35;
const GLOW_EM = 0.32;
const LIFT_EM = 0.5;
const CHECK_SVG = '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="10" fill="currentColor"/><path d="M5.6 10.4l2.9 2.8 5.9-6.1" fill="none" stroke="#0b0d0c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHEVRON_UP = '<svg viewBox="0 0 12 12"><path d="M3 7.5l3-3 3 3" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
const CHEVRON_DOWN = '<svg viewBox="0 0 12 12"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
const DOC_SVG = '<svg viewBox="0 0 16 16"><path d="M4 1.5h5.5L12.5 4.5V14.5H4z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M6 8h4.5M6 10.5h4.5" stroke="currentColor" stroke-width="1.3"/></svg>';
const PLAY_SVG = '<svg viewBox="0 0 16 16"><path d="M4.5 2.5l9 5.5-9 5.5z" fill="currentColor"/></svg>';
const LOGO_SVG = '<svg viewBox="0 0 24 24"><path d="M3 21V3h7l-7 9z" fill="var(--ww-accent)"/><path d="M12 3h9l-9 9h9l-9 9z" fill="var(--ww-accent)" opacity="0.75"/></svg>';

root.insertAdjacentHTML('beforeend', '<div class="ww"><div class="ww-glow"></div><div class="ww-stage"><div class="ww-panel"></div></div><div class="ww-text"><span class="ww-lead"></span><div class="ww-wheel"></div></div><span class="ww-text ww-measure"></span></div>');

const scene = root.querySelector('.ww');
const glow = root.querySelector('.ww-glow');
const stage = root.querySelector('.ww-stage');
const panel = root.querySelector('.ww-panel');
const textBox = root.querySelector('.ww-text');
const lead = root.querySelector('.ww-lead');
const wheel = root.querySelector('.ww-wheel');
const measure = root.querySelector('.ww-measure');

let cache = { lookKey: '', wordsKey: '', words: [], nodes: [], panelKey: '', video: null, measureKey: '', measured: null };

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
  const key = JSON.stringify([p.lead, p.words]);
  if (key === cache.wordsKey) {
    return cache.words;
  }
  const given = listOf(p.words);
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

const sideHtml = (p) => {
  const items = listOf(p.menu).map((item) => '<div class="ww-item">' + escapeHtml(item) + '</div>').join('');
  return '<div class="ww-side"><div class="ww-chip"><span class="ww-logo">' + LOGO_SVG + '</span><span class="ww-brand">' + escapeHtml(p.brand) + '</span><span class="ww-pill">v2.0</span></div>' +
    '<div class="ww-label">Get started</div><div class="ww-item is-on">Welcome</div>' +
    '<div class="ww-label">Features' + CHEVRON_UP + '</div>' + items +
    '<div class="ww-label">Settings' + CHEVRON_DOWN + '</div><div class="ww-label">Information' + CHEVRON_DOWN + '</div></div>';
};

const mainHtml = (p) => {
  const item = mediaList(p.media)[0];
  if (item) {
    return '<div class="ww-main">' + (item.video ? '<video class="ww-shot" muted playsinline preload="auto" src="' + item.src + '"></video>' : '<img class="ww-shot" decoding="sync" src="' + item.src + '">') + '</div>';
  }
  return '<div class="ww-main"><div class="ww-hello">Hello, <b>' + escapeHtml(p.user) + '</b><br>Welcome to ' + escapeHtml(p.brand) + ' Studio</div>' +
    '<div class="ww-status"><span class="ww-ok">' + CHECK_SVG + 'License active</span><span>Upgrade available</span></div>' +
    '<div class="ww-card"><div class="ww-kicker">' + escapeHtml(p.kicker) + '</div><div class="ww-head">' + escapeHtml(p.headline) + '</div>' +
    '<div class="ww-copy">Build, launch and grow faster with ready-made blocks, smart layouts and one calm place for every page.</div>' +
    '<div class="ww-actions"><span class="ww-button">' + DOC_SVG + 'Read the docs</span><span class="ww-button">' + PLAY_SVG + 'Watch the tour</span></div></div>' +
    '<div class="ww-card"><div class="ww-news">What\'s new</div>' +
    '<div class="ww-row"><span class="ww-ok">' + CHECK_SVG + '</span>Theme builder<small>Design headers, archives, carts and checkout pages visually.</small></div>' +
    '<div class="ww-row"><span class="ww-ok">' + CHECK_SVG + '</span>New extensions<small>Twelve new blocks for forms, pricing and stories.</small></div></div></div>';
};

const paintPanel = (p) => {
  const key = JSON.stringify([p.brand, p.user, p.kicker, p.headline, p.menu, p.media]);
  if (key === cache.panelKey) {
    return;
  }
  panel.innerHTML = '<div class="ww-ui">' + sideHtml(p) + mainHtml(p) + '</div><div class="ww-shade"></div>';
  const video = panel.querySelector('video');
  if (video) {
    video.addEventListener('loadedmetadata', () => seekVideo(video, tl.time()));
  }
  cache = { ...cache, panelKey: key, video };
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
