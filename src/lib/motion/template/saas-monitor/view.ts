export const MOCKUP_VIEW = String.raw`
const VIDEO_MARK = 'video:';
const LINK = /^(https?:|data:|blob:|\/)/;
const DEPTH = 0.016;
const PERSPECTIVE = 3.2;
const CORNER = 0.016;
const RIM = 0.005;
const SCREEN_SCALE = 2;
const ARM_W = 0.2;
const ARM_D = 0.012;
const ARM_TILT = 14;
const STAND_H = 0.3;
const FOOT_W = 0.3;
const FOOT_D = 0.24;
const FOOT_H = 0.008;
const FLOOR_W = 1.25;
const FLOOR_D = 0.7;
const BLUR_UNIT = 0.0025;
const SHEEN_PER_DEGREE = 1.6;
const CURSOR_TRAVEL = { x: 16, y: 12 };
const BAR_HEIGHTS = [0.42, 0.55, 0.48, 0.66, 0.6, 0.74, 0.7, 0.83, 0.78, 0.9, 0.86, 0.97];
const SIDE_ROWS = ['Overview', 'Roadmap', 'Research', 'Feedback', 'Agents', 'Settings'];
const STATS = [['Shipped', '48'], ['In review', '12'], ['Insights', '1,284']];
const GRAIN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0"/></filter><rect width="180" height="180" filter="url(#n)"/></svg>';
const CURSOR_SVG = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 2.5 L5 19.5 L9.4 15.4 L12.3 21.6 L15.2 20.3 L12.4 14.2 L18.4 14.2 Z" fill="#0b0b10" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round"/></svg>';

root.insertAdjacentHTML('beforeend', '<div class="sm"><div class="sm-light"></div><h2 class="sm-mark"></h2><div class="sm-stage"><div class="sm-rig"></div></div><div class="sm-grain"></div></div>');

const scene = root.querySelector('.sm');
const mark = root.querySelector('.sm-mark');
const stage = root.querySelector('.sm-stage');
const rig = root.querySelector('.sm-rig');
const grain = root.querySelector('.sm-grain');
grain.style.backgroundImage = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(GRAIN_SVG) + '")';

let cache = { rigKey: '', siteKey: '', lookKey: '', textEm: 0, parts: null, site: null };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });
const fontOf = (p) => (String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
};

const FACES = [
  ['front', (w, h, d) => [w, h, 'translateZ(' + d / 2 + 'px)']],
  ['back', (w, h, d) => [w, h, 'rotateY(180deg) translateZ(' + d / 2 + 'px)']],
  ['right', (w, h, d) => [d, h, 'rotateY(90deg) translateZ(' + w / 2 + 'px)']],
  ['left', (w, h, d) => [d, h, 'rotateY(-90deg) translateZ(' + w / 2 + 'px)']],
  ['top', (w, h, d) => [w, d, 'rotateX(90deg) translateZ(' + h / 2 + 'px)']],
  ['bottom', (w, h, d) => [w, d, 'rotateX(-90deg) translateZ(' + h / 2 + 'px)']]
];

const solid = (part, w, h, d, x, y, z, tilt = 0) => {
  const box = el('div', 'sm-box ' + part);
  box.style.transform = 'translate3d(' + x + 'px,' + y + 'px,' + z + 'px) rotateX(' + tilt + 'deg)';
  const faces = {};
  for (const [name, shape] of FACES) {
    const [fw, fh, turn] = shape(w, h, d);
    const face = el('div', 'sm-face sm-' + name);
    face.style.width = fw + 'px';
    face.style.height = fh + 'px';
    face.style.left = -fw / 2 + 'px';
    face.style.top = -fh / 2 + 'px';
    face.style.transform = turn;
    box.appendChild(face);
    faces[name] = face;
  }
  rig.appendChild(box);
  return faces;
};

const plane = (className, w, d, y, z) => {
  const node = el('div', className);
  node.style.width = w + 'px';
  node.style.height = d + 'px';
  node.style.left = -w / 2 + 'px';
  node.style.top = -d / 2 + 'px';
  node.style.transform = 'translate3d(0,' + y + 'px,' + z + 'px) rotateX(90deg)';
  rig.appendChild(node);
};

const measureEm = (p) => {
  const probe = el('span', 'sm-mark', p.watermark);
  probe.style.visibility = 'hidden';
  probe.style.fontFamily = fontOf(p);
  probe.style.fontSize = '100px';
  scene.appendChild(probe);
  const em = probe.getBoundingClientRect().width / 100;
  probe.remove();
  return em;
};

const buildRig = (p, layout, unit) => {
  const key = JSON.stringify([unit, layout.bodyW, layout.bodyH]);
  if (key === cache.rigKey) {
    return cache.parts;
  }
  rig.innerHTML = '';
  const w = layout.bodyW * unit;
  const h = layout.bodyH * unit;
  const d = DEPTH * w;
  const standBottom = h / 2 + STAND_H * h;
  const armTop = h * 0.08;
  const armH = (standBottom - armTop) / Math.cos((ARM_TILT * Math.PI) / 180);
  const armZ = -(d / 2 + ARM_D * w);
  const lean = Math.tan((ARM_TILT * Math.PI) / 180) * (standBottom - armTop);
  const footZ = armZ - lean / 2 + FOOT_D * w * 0.1;
  plane('sm-floor', FLOOR_W * w, FLOOR_D * w, standBottom + 1, footZ);
  plane('sm-contact', FOOT_W * w * 1.15, FOOT_D * w * 1.1, standBottom + 0.5, footZ);
  solid('sm-foot', FOOT_W * w, FOOT_H * w, FOOT_D * w, 0, standBottom - (FOOT_H * w) / 2, footZ);
  solid('sm-arm', ARM_W * w, armH, ARM_D * w, 0, (armTop + standBottom) / 2, armZ - lean / 2, ARM_TILT);
  const body = solid('sm-body', w, h, d, 0, 0, 0);
  const radius = CORNER * w + 'px';
  body.front.style.borderRadius = radius;
  body.back.style.borderRadius = radius;
  const black = el('div', 'sm-bezel');
  black.style.inset = RIM * w + 'px';
  black.style.borderRadius = CORNER * w - RIM * w + 'px';
  const sw = layout.screenW * unit;
  const sh = sw * (9 / 16);
  const screen = el('div', 'sm-screen');
  screen.style.left = (w - sw) / 2 + 'px';
  screen.style.top = (h - sh) / 2 + 'px';
  screen.style.width = sw * SCREEN_SCALE + 'px';
  screen.style.height = sh * SCREEN_SCALE + 'px';
  screen.style.transform = 'scale(' + 1 / SCREEN_SCALE + ')';
  const glass = el('div', 'sm-glass');
  body.front.append(black, screen, glass);
  scene.style.setProperty('--sm-bw', w + 'px');
  stage.style.perspective = PERSPECTIVE * unit + 'px';
  cache = { ...cache, rigKey: key, siteKey: '', parts: { screen, glass } };
  return cache.parts;
};

const mediaOf = (raw) => {
  const item = String(raw || '').trim();
  const video = item.startsWith(VIDEO_MARK);
  const id = video ? item.slice(VIDEO_MARK.length).trim() : item;
  const src = LINK.test(id) ? id : assets[id];
  return src ? { src, video } : null;
};

const siteNode = (p) => {
  const page = el('div', 'sm-page');
  const nav = el('nav', 'sm-nav');
  const logo = el('div', 'sm-logo');
  logo.appendChild(el('i'));
  logo.appendChild(el('span', '', p.siteBrand));
  const links = el('div', 'sm-links');
  String(p.navItems || '').split(',').map((s) => s.trim()).filter(Boolean).forEach((item) => links.appendChild(el('span', '', item)));
  const actions = el('div', 'sm-actions');
  actions.appendChild(el('span', '', 'Sign in'));
  actions.appendChild(el('b', 'sm-btn', 'Get started'));
  nav.append(logo, links, actions);

  const hero = el('section', 'sm-hero');
  const badge = el('span', 'sm-badge');
  const [lead, ...rest] = String(p.badge || '').split('·');
  badge.appendChild(el('b', '', rest.length ? lead.trim() + ' · ' : ''));
  badge.appendChild(document.createTextNode((rest.length ? rest.join('·') : lead).trim()));
  const h1 = el('h1', 'sm-h1');
  const chars = [];
  String(p.headline || '').split('').forEach((c) => {
    if (c === '\n') {
      h1.appendChild(el('br'));
      return;
    }
    const span = el('span', 'sm-char', c);
    h1.appendChild(span);
    chars.push(span);
  });
  const caret = el('i', 'sm-caret');
  const sub = el('p', 'sm-sub', p.subtext);
  const ctas = el('div', 'sm-ctas');
  const cta = el('b', 'sm-btn sm-cta', p.primaryCta);
  ctas.append(cta, el('b', 'sm-btn sm-ghost', p.secondaryCta));
  hero.append(p.badge ? badge : el('span'), h1, sub, ctas);

  const product = el('section', 'sm-product');
  const app = el('div', 'sm-app');
  const side = el('div', 'sm-side');
  SIDE_ROWS.forEach((row, i) => side.appendChild(el('div', 'sm-side-row' + (i === 0 ? ' on' : ''), row)));
  const main = el('div', 'sm-main');
  main.appendChild(el('h3', '', p.productName));
  main.appendChild(el('p', '', 'Q3 launch · 12 features in flight'));
  const stats = el('div', 'sm-stats');
  STATS.forEach(([label, value]) => {
    const stat = el('div', 'sm-stat');
    stat.append(el('span', '', label), el('b', '', value));
    stats.appendChild(stat);
  });
  const chart = el('div', 'sm-chart');
  const bars = BAR_HEIGHTS.map((_, i) => chart.appendChild(el('i', 'sm-bar' + (i === BAR_HEIGHTS.length - 1 ? ' on' : ''))));
  main.append(stats, chart);
  app.append(side, main);
  product.appendChild(app);

  const cursor = el('div', 'sm-cursor');
  cursor.innerHTML = CURSOR_SVG;
  page.append(nav, hero, product, cursor);
  return { page, chars, caret, sub, ctas, cta, product, bars, cursor };
};

const buildScreen = (p, screen) => {
  const media = p.screenSource === 'asset' ? mediaOf(p.screenAsset) : null;
  const key = JSON.stringify([media, media ? '' : [p.siteBrand, p.navItems, p.badge, p.headline, p.subtext, p.primaryCta, p.secondaryCta, p.productName]]);
  if (key === cache.siteKey) {
    return cache.site;
  }
  screen.innerHTML = '';
  if (media) {
    const node = el(media.video ? 'video' : 'img', 'sm-media');
    if (media.video) {
      node.muted = true;
      node.playsInline = true;
      node.preload = 'auto';
      node.addEventListener('loadedmetadata', () => seekVideo(node, tl.time()));
    }
    node.src = media.src;
    screen.appendChild(node);
    cache = { ...cache, siteKey: key, site: { video: media.video ? node : null } };
    return cache.site;
  }
  const site = siteNode(p);
  screen.appendChild(site.page);
  cache = { ...cache, siteKey: key, site };
  return site;
};

const seekVideo = (video, t) => {
  if (!video || !(video.duration > 0)) {
    return;
  }
  const at = t % video.duration;
  if (Math.abs(video.currentTime - at) > 0.5 / fps) {
    video.currentTime = at;
  }
};

const paintLook = (p) => {
  const key = JSON.stringify([p.font, p.accent, p.backgroundFrom, p.backgroundTo, p.watermarkColor, p.watermarkOpacity, p.grain, p.finish, p.watermark]);
  if (key === cache.lookKey) {
    return;
  }
  const s = scene.style;
  scene.dataset.finish = p.finish;
  s.setProperty('--sm-font', fontOf(p));
  s.setProperty('--sm-accent', p.accent);
  s.setProperty('--sm-from', p.backgroundFrom);
  s.setProperty('--sm-to', p.backgroundTo);
  s.setProperty('--sm-mark-ink', p.watermarkColor);
  mark.textContent = p.watermark;
  mark.style.opacity = String(p.watermarkOpacity);
  grain.style.opacity = String(p.grain);
  cache = { ...cache, lookKey: key, textEm: measureEm(p) };
};

const paintSite = (site, f) => {
  const shown = Math.round(f.typed * site.chars.length);
  site.chars.forEach((c, i) => {
    c.style.visibility = i < shown ? 'visible' : 'hidden';
  });
  const after = site.chars[Math.max(0, shown - 1)];
  if (after && after.nextSibling !== site.caret) {
    after.after(site.caret);
  }
  const blink = Math.floor(tl.time() * 2) % 2 === 0;
  site.caret.style.opacity = f.typing && (f.typed < 1 || blink) ? '1' : '0';

  const rise = (1 - f.reveal) * 0.8;
  site.sub.style.opacity = String(f.reveal);
  site.sub.style.transform = 'translateY(' + rise + 'cqw)';
  site.ctas.style.opacity = String(f.reveal);
  site.ctas.style.transform = 'translateY(' + rise * 1.4 + 'cqw)';

  const h = f.hover;
  site.cta.style.background = 'color-mix(in srgb, var(--sm-accent) ' + (h * 100).toFixed(1) + '%, var(--ink))';
  site.cta.style.transform = 'translateY(' + -0.18 * h + 'cqw)';
  site.cta.style.boxShadow = '0 ' + 0.6 * h + 'cqw ' + 1.6 * h + 'cqw color-mix(in srgb, var(--sm-accent) ' + (45 * h).toFixed(1) + '%, transparent)';

  const target = { x: site.cta.offsetLeft + site.cta.offsetWidth * 0.62, y: site.cta.offsetTop + site.cta.offsetHeight * 0.55 };
  const cqw = site.page.clientWidth / 100;
  const away = 1 - f.cursor;
  site.cursor.style.opacity = props.cursor ? String(smooth(clamp01(f.cursor * 3))) : '0';
  site.cursor.style.transform = 'translate(' + (target.x + CURSOR_TRAVEL.x * cqw * away) + 'px,' + (target.y + CURSOR_TRAVEL.y * cqw * away) + 'px)';

  site.page.style.transform = 'translateY(' + -f.scroll * (site.product.offsetTop - 3.4 * cqw) + 'px)';
  site.bars.forEach((bar, i) => {
    const grow = clamp01(f.bars * 1.6 - i * 0.05);
    bar.style.transform = 'scaleY(' + (BAR_HEIGHTS[i] * (0.25 + 0.75 * smooth(grow))).toFixed(4) + ')';
  });
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  const unit = Math.min(width, height);
  paintLook(p);
  const layout = mockupLayout(p, width, height, cache.textEm);
  const parts = buildRig(p, layout, unit);
  const site = buildScreen(p, parts.screen);
  const f = mockupFrame(p, t, duration);

  mark.style.fontSize = layout.em * unit + 'px';
  mark.style.transform = 'translate(calc(-50% + ' + f.markShift * unit + 'px), calc(-50% + ' + p.watermarkY * unit + 'px))';
  mark.style.filter = p.depthBlur > 0 ? 'blur(' + p.depthBlur * unit * BLUR_UNIT + 'px)' : 'none';

  const pose = f.pose;
  stage.style.opacity = String(pose.opacity);
  rig.style.transform = 'translate3d(0,' + (p.monitorY + pose.lift + f.float) * unit + 'px,0) rotateX(' + pose.pitch + 'deg) rotateY(' + pose.yaw + 'deg) scale(' + pose.scale + ')';
  const sheen = 46 + pose.yaw * SHEEN_PER_DEGREE * -1;
  parts.glass.style.setProperty('--sm-sheen-a', sheen - 14 + '%');
  parts.glass.style.setProperty('--sm-sheen-b', sheen + '%');
  parts.glass.style.setProperty('--sm-sheen-c', sheen + 12 + '%');

  if (site.page) {
    paintSite(site, f);
  }
  if (site.video) {
    seekVideo(site.video, t);
  }
};

draw();
if (document.fonts && document.fonts.status !== 'loaded') {
  document.fonts.ready.then(() => {
    cache = { ...cache, lookKey: '' };
    draw();
  });
}
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
