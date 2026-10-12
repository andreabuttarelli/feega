export const MOCKUP_VIEW = String.raw`
const VIDEO_MARK = 'video:';
const LINK = /^(https?:|data:|blob:|\/)/;
const SCREEN_SCALE = 2;
const FOV = 22;
const CORNER = 0.02;
const DEPTH = 0.014;
const BEVEL = 0.003;
const RIM = 0.006;
const ARM_W = 0.19;
const ARM_D = 0.012;
const ARM_TILT = 0.27;
const ARM_TOP = 0.08;
const STAND_H = 0.34;
const FOOT_W = 0.27;
const FOOT_D = 0.22;
const FOOT_H = 0.007;
const FOOT_LEAD = 0.3;
const SHADOW_MAP = 1024;
const AO_TEXTURE = 256;
const FINISHES = {
  silver: { color: 0xc9ccd1, roughness: 0.32 },
  black: { color: 0x2b2c30, roughness: 0.42 }
};
const STUDIO_PANELS = [
  [-2.6, 2.2, 1.8, 3.2, 2.2, 0.1, 9],
  [2.8, 1.4, 2.2, 1.6, 3.2, 0.1, 5],
  [0, 3.4, 0, 4, 0.1, 3, 6],
  [0, 0.6, -4.8, 6, 2.4, 0.1, 2.4],
  [0, -0.4, 5.5, 6, 3, 0.1, 4]
];
const BLUR_UNIT = 0.0025;
const SHEEN_PER_DEGREE = 1.6;
const DEG = Math.PI / 180;
const CURSOR_TRAVEL = { x: 16, y: 12 };
const BAR_HEIGHTS = [0.42, 0.55, 0.48, 0.66, 0.6, 0.74, 0.7, 0.83, 0.78, 0.9, 0.86, 0.97];
const SIDE_ROWS = ['Overview', 'Roadmap', 'Research', 'Feedback', 'Agents', 'Settings'];
const STATS = [['Shipped', '48'], ['In review', '12'], ['Insights', '1,284']];
const GRAIN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0"/></filter><rect width="180" height="180" filter="url(#n)"/></svg>';
const CURSOR_SVG = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 2.5 L5 19.5 L9.4 15.4 L12.3 21.6 L15.2 20.3 L12.4 14.2 L18.4 14.2 Z" fill="#0b0b10" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round"/></svg>';

root.insertAdjacentHTML('beforeend', '<div class="sm"><div class="sm-light"></div><h2 class="sm-mark"></h2><div class="sm-stage"><canvas class="sm-canvas"></canvas><div class="sm-screen"><div class="sm-content"></div><div class="sm-glass"></div></div></div><div class="sm-grain"></div></div>');

const scene = root.querySelector('.sm');
const mark = root.querySelector('.sm-mark');
const stage = root.querySelector('.sm-stage');
const canvas = root.querySelector('.sm-canvas');
const overlay = root.querySelector('.sm-screen');
const content = root.querySelector('.sm-content');
const glass = root.querySelector('.sm-glass');
const grain = root.querySelector('.sm-grain');
grain.style.backgroundImage = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(GRAIN_SVG) + '")';

let cache = { sizeKey: '', siteKey: '', lookKey: '', textEm: 0, site: null, monitor: null };

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

const rounded = (w, h, r) => {
  const x = -w / 2;
  const y = -h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
};

const slab = (w, h, r, depth, bevel) => {
  const geometry = new THREE.ExtrudeGeometry(rounded(w, h, r), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
};

const studioRoom = () => {
  const room = new THREE.Scene();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const wall = new THREE.MeshBasicMaterial({ color: 0x8a86a0, side: THREE.BackSide });
  const shell = new THREE.Mesh(cube, wall);
  shell.scale.set(12, 8, 12);
  room.add(shell);
  const glows = STUDIO_PANELS.map(([x, y, z, sx, sy, sz, k]) => {
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k) });
    const panel = new THREE.Mesh(cube, glow);
    panel.position.set(x, y, z);
    panel.scale.set(sx, sy, sz);
    room.add(panel);
    return glow;
  });
  return { room, dispose: () => [cube, wall, ...glows].forEach((d) => d.dispose()) };
};

const aoTexture = () => {
  const c = document.createElement('canvas');
  c.width = AO_TEXTURE;
  c.height = AO_TEXTURE;
  const g = c.getContext('2d');
  const half = AO_TEXTURE / 2;
  const fade = g.createRadialGradient(half, half, 0, half, half, half);
  fade.addColorStop(0, 'rgba(24,10,60,0.85)');
  fade.addColorStop(0.45, 'rgba(24,10,60,0.35)');
  fade.addColorStop(1, 'rgba(24,10,60,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, AO_TEXTURE, AO_TEXTURE);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const world = (() => {
  const renderer = three.renderer(canvas);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene3 = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = studioRoom();
  const env = pmrem.fromScene(studio.room, 0.04).texture;
  studio.dispose();
  pmrem.dispose();
  scene3.environment = env;
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 60);
  const rig = new THREE.Group();
  scene3.add(rig);

  const metal = new THREE.MeshPhysicalMaterial({ color: FINISHES.silver.color, metalness: 1, roughness: FINISHES.silver.roughness, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  const glassBlack = new THREE.MeshPhysicalMaterial({ color: 0x050506, metalness: 0, roughness: 0.08, clearcoat: 1 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x050506 });
  const shadowCatcher = new THREE.ShadowMaterial({ color: 0x1c0b4a, opacity: 0.14 });
  const ao = aoTexture();
  const aoMaterial = new THREE.MeshBasicMaterial({ map: ao, transparent: true, depthWrite: false });
  const hemi = new THREE.HemisphereLight(0xffffff, 0x7c5cff, 0.35);
  const fill = new THREE.DirectionalLight(0xffffff, 1.1);
  fill.position.set(0.4, 0.6, 3);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-0.25, 5, 0.9);
  key.castShadow = true;
  key.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  key.shadow.radius = 24;
  Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 8 });
  key.shadow.camera.updateProjectionMatrix();
  scene3.add(hemi, fill, key, key.target);

  const geometries = [];
  const add = (geometry, material, at, shadow) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(at[0], at[1], at[2]);
    mesh.castShadow = shadow;
    rig.add(mesh);
    geometries.push(geometry);
    return mesh;
  };
  return { renderer, scene: scene3, camera, rig, metal, glassBlack, dark, shadowCatcher, aoMaterial, hemi, key, add, geometries, env, ao };
})();

const buildMonitor = (layout) => {
  const W = 1;
  const H = layout.bodyH / layout.bodyW;
  const sw = layout.screenW / layout.bodyW;
  const sh = sw * (9 / 16);
  const front = DEPTH / 2 + BEVEL;
  world.add(slab(W, H, CORNER, DEPTH, BEVEL), world.metal, [0, 0, 0], true);
  world.add(new THREE.ShapeGeometry(rounded(W - 2 * RIM, H - 2 * RIM, CORNER - RIM), 10), world.glassBlack, [0, 0, front + 0.0004], false);
  world.add(new THREE.PlaneGeometry(sw, sh), world.dark, [0, 0, front + 0.0008], false);

  const top = ARM_TOP * H;
  const bottom = -(H / 2 + STAND_H * H);
  const drop = top - bottom;
  const back = -(DEPTH / 2 + BEVEL + ARM_D / 2);
  const lean = drop * Math.tan(ARM_TILT);
  const arm = world.add(new THREE.BoxGeometry(ARM_W, drop / Math.cos(ARM_TILT), ARM_D), world.metal, [0, (top + bottom) / 2, back - lean / 2], true);
  arm.rotation.x = ARM_TILT;

  const foot = world.add(slab(FOOT_W, FOOT_D, 0.02, FOOT_H, 0.002), world.metal, [0, bottom + FOOT_H / 2 + 0.002, back - lean + FOOT_D * FOOT_LEAD], true);
  foot.rotation.x = -Math.PI / 2;

  const floor = world.add(new THREE.PlaneGeometry(5, 5), world.shadowCatcher, [0, bottom - 0.0005, 0], false);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const blob = world.add(new THREE.PlaneGeometry(1.3, 0.75), world.aoMaterial, [0, bottom + 0.0005, back - lean * 0.6], false);
  blob.rotation.x = -Math.PI / 2;
  const contact = world.add(new THREE.PlaneGeometry(FOOT_W * 1.5, FOOT_D * 1.5), world.aoMaterial, [0, bottom + 0.0008, foot.position.z], false);
  contact.rotation.x = -Math.PI / 2;

  world.key.target.position.set(0, bottom, 0);
  world.key.target.updateMatrixWorld();
  world.renderer.compile(world.scene, world.camera);
  return { sw, sh, front };
};

onDestroy(() => {
  world.geometries.forEach((g) => g.dispose());
  [world.metal, world.glassBlack, world.dark, world.shadowCatcher, world.aoMaterial].forEach((m) => m.dispose());
  world.ao.dispose();
  world.env.dispose();
  world.renderer.dispose();
});

const corner = new THREE.Vector3();

const project = (x, y, z, width, height) => {
  corner.set(x, y, z).applyMatrix4(world.rig.matrixWorld).project(world.camera);
  return [((corner.x + 1) / 2) * width, ((1 - corner.y) / 2) * height];
};

const solve = (rows, values) => {
  const n = values.length;
  const m = rows.map((row, i) => [...row, values[i]]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) {
      if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) {
        pivot = r;
      }
    }
    [m[c], m[pivot]] = [m[pivot], m[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) {
        continue;
      }
      const k = m[r][c] / m[c][c];
      for (let j = c; j <= n; j++) {
        m[r][j] -= k * m[c][j];
      }
    }
  }
  return m.map((row, i) => row[n] / row[i]);
};

const homography = (from, to) => {
  const rows = [];
  const values = [];
  from.forEach(([x, y], i) => {
    const [u, v] = to[i];
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    values.push(u);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(v);
  });
  const h = solve(rows, values);
  return 'matrix3d(' + [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1].join(',') + ')';
};

const fitWorld = (layout, width, height, unit) => {
  const key = JSON.stringify([width, height, layout.bodyW, layout.bodyH, layout.screenW]);
  if (key === cache.sizeKey) {
    return cache.monitor;
  }
  world.rig.clear();
  world.geometries.forEach((g) => g.dispose());
  world.geometries.length = 0;
  world.renderer.setSize(width, height, false);
  const perShort = 1 / layout.bodyW;
  const visible = 2 * layout.box.ay * perShort;
  world.camera.aspect = width / height;
  world.camera.position.set(0, 0, visible / (2 * Math.tan((FOV * DEG) / 2)));
  world.camera.updateProjectionMatrix();
  world.camera.updateMatrixWorld();
  const monitor = { ...buildMonitor(layout), perShort, dw: layout.screenW * unit * SCREEN_SCALE };
  monitor.dh = monitor.dw * (9 / 16);
  overlay.style.width = monitor.dw + 'px';
  overlay.style.height = monitor.dh + 'px';
  cache = { ...cache, sizeKey: key, monitor };
  return monitor;
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

const mediaOf = (raw) => {
  if (Array.isArray(raw)) {
    return raw[0] && raw[0].src ? { src: raw[0].src, video: raw[0].kind === 'video' } : null;
  }
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
  const monitor = fitWorld(layout, width, height, unit);
  const site = buildScreen(p, content);
  const f = mockupFrame(p, t, duration);

  mark.style.fontSize = layout.em * unit + 'px';
  mark.style.transform = 'translate(calc(-50% + ' + f.markShift * unit + 'px), calc(-50% + ' + p.watermarkY * unit + 'px))';
  mark.style.filter = p.depthBlur > 0 ? 'blur(' + p.depthBlur * unit * BLUR_UNIT + 'px)' : 'none';

  const pose = f.pose;
  stage.style.opacity = String(pose.opacity);
  const finish = FINISHES[p.finish] || FINISHES.silver;
  world.metal.color.setHex(finish.color);
  world.metal.roughness = finish.roughness;
  world.hemi.groundColor.set(p.accent);
  world.rig.position.y = -(p.monitorY + pose.lift + f.float) * monitor.perShort;
  world.rig.rotation.set(-pose.pitch * DEG, pose.yaw * DEG, 0);
  world.rig.scale.setScalar(pose.scale);
  world.rig.updateMatrixWorld(true);
  world.renderer.render(world.scene, world.camera);
  const z = monitor.front + 0.001;
  const to = [project(-monitor.sw / 2, monitor.sh / 2, z, width, height), project(monitor.sw / 2, monitor.sh / 2, z, width, height), project(monitor.sw / 2, -monitor.sh / 2, z, width, height), project(-monitor.sw / 2, -monitor.sh / 2, z, width, height)];
  overlay.style.transform = homography([[0, 0], [monitor.dw, 0], [monitor.dw, monitor.dh], [0, monitor.dh]], to);
  const sheen = 46 + pose.yaw * SHEEN_PER_DEGREE * -1;
  glass.style.setProperty('--sm-sheen-a', sheen - 14 + '%');
  glass.style.setProperty('--sm-sheen-b', sheen + '%');
  glass.style.setProperty('--sm-sheen-c', sheen + 12 + '%');

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
