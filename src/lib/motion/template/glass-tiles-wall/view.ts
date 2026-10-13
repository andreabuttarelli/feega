import { MEDIA_LIST } from '../media-list';

export const GTW_VIEW = String.raw`
${MEDIA_LIST}
const FACE_PIXELS = 1024;
const SLAB_DEPTH = 0.08;
const SLAB_BEVEL = 0.07;
const MEDIA_INSET = 0.015;
const CURVE_SEGMENTS = 10;
const BEVEL_SEGMENTS = 8;
const ENV_BLUR = 0.03;
const SIDE_GLARE = 2.6;
const SIDE_DIM = 0.75;
const GLASS_IOR = 1.5;
const GLASS_DISPERSION = 0.6;
const GLASS_TINT = 0xd4dbe6;
const ATTENUATION_DEPTHS = 4;
const STUDIO_PANELS = [
  [-3.2, 2.4, 2.4, 3.2, 0.12, 0.1, 9],
  [3.4, 1.2, 1.8, 0.12, 3.4, 0.1, 9],
  [0, 3.8, 0.5, 6, 0.1, 0.25, 3],
  [-1, 3.2, 4.5, 5, 0.1, 1.6, 0.6],
  [2.4, -1.6, 4, 0.08, 1.4, 0.1, 8],
  [-5, -0.2, 0.4, 0.1, 0.18, 4, 6],
  [5, 0.4, -0.6, 0.1, 0.18, 3, 6],
  [0, -3, 2, 8, 0.1, 0.2, 0.5]
];

root.insertAdjacentHTML('beforeend', '<div class="gt"><canvas class="gt-canvas"></canvas><i class="gt-vignette"></i></div>');

const scene = root.querySelector('.gt');
const canvas = root.querySelector('.gt-canvas');

let cache = { layoutKey: '', layout: null, tilesKey: '', tiles: [], faces: [], lookKey: '', glass: 1 };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });
const listOf = (raw, mark) => String(raw || '').split(mark).map((s) => s.trim()).filter(Boolean);
const fontOf = (p) => (String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');

const roundedShape = (w, h, r) => {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
};

const studioRoom = () => {
  const room = new THREE.Scene();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const wall = new THREE.MeshBasicMaterial({ color: 0x0c0e18, side: THREE.BackSide });
  const shell = new THREE.Mesh(cube, wall);
  shell.scale.set(14, 10, 14);
  room.add(shell);
  const glows = STUDIO_PANELS.map(([x, y, z, w, h, d, k]) => {
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k) });
    const panel = new THREE.Mesh(cube, glow);
    panel.position.set(x, y, z);
    panel.scale.set(w, h, d);
    room.add(panel);
    return glow;
  });
  return { room, dispose: () => [cube, wall, ...glows].forEach((d) => d.dispose()) };
};

const world = (() => {
  const renderer = three.renderer(canvas);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene3 = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = studioRoom();
  const env = pmrem.fromScene(studio.room, ENV_BLUR).texture;
  studio.dispose();
  pmrem.dispose();
  scene3.environment = env;
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 1, 100000);
  const wall = new THREE.Group();
  scene3.add(wall);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0, transmission: 1, ior: GLASS_IOR, dispersion: GLASS_DISPERSION, attenuationColor: new THREE.Color(GLASS_TINT), specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1 });
  return { renderer, scene: scene3, camera, wall, glass, env, geometries: [] };
})();

onDestroy(() => {
  world.geometries.forEach((g) => g.dispose());
  cache.faces.forEach((f) => {
    f.texture.dispose();
    f.material.dispose();
  });
  cache.tiles.forEach(disposeTile);
  world.glass.dispose();
  world.env.dispose();
  world.renderer.dispose();
});

const faceGeometry = (fw, fh, corner, z) => {
  const face = new THREE.ShapeGeometry(roundedShape(fw, fh, corner), CURVE_SEGMENTS);
  const uv = face.attributes.uv;
  const at = face.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, at.getX(i) / fw + 0.5, at.getY(i) / fh + 0.5);
  }
  face.translate(0, 0, z);
  return face;
};

const layoutFor = (p) => {
  const { width, height } = sizeOf();
  const key = JSON.stringify([width, height, p.tileSize, p.tileAspect, p.gap, p.curve, p.moves, p.step, p.roundness, p.thickness]);
  if (key === cache.layoutKey) {
    return cache.layout;
  }
  const layout = wallLayout(p, width, height);
  const w = layout.tileW;
  const h = layout.tileH;
  const bevel = SLAB_BEVEL * w;
  const depth = Math.max(1, p.thickness * SLAB_DEPTH * w);
  const corner = Math.min(Math.max(p.roundness * w, bevel * 1.5), h / 2 - bevel);
  world.geometries.forEach((g) => g.dispose());
  const slab = new THREE.ExtrudeGeometry(roundedShape(w - 2 * bevel, h - 2 * bevel, corner - bevel), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: BEVEL_SEGMENTS, curveSegments: CURVE_SEGMENTS });
  slab.translate(0, 0, -depth / 2);
  const inset = MEDIA_INSET * w;
  const faceW = w - 2 * inset;
  const faceH = h - 2 * inset;
  const face = faceGeometry(faceW, faceH, Math.max(1, corner - inset), -depth / 2 - bevel * 0.9);
  world.geometries = [slab, face];
  world.renderer.setSize(width, height, false);
  world.camera.aspect = width / height;
  world.camera.fov = (2 * Math.atan(height / 2 / layout.distance)) / DEG;
  world.camera.near = layout.distance * 0.05;
  world.camera.far = layout.distance * 4;
  world.camera.updateProjectionMatrix();
  cache = { ...cache, layoutKey: key, layout: { ...layout, slab, face, faceW, faceH, depth }, tilesKey: '' };
  return cache.layout;
};

const coverDraw = (g, source, sw, sh, w, h) => {
  if (!(sw > 0 && sh > 0)) {
    return;
  }
  const scale = Math.max(w / sw, h / sh);
  g.drawImage(source, (w - sw * scale) / 2, (h - sh * scale) / 2, sw * scale, sh * scale);
};

const paintFace = (f, p) => {
  const { g, width: w, height: h } = f;
  g.fillStyle = p.placeholderColor;
  g.fillRect(0, 0, w, h);
  const m = f.media;
  if (mediaReady(m)) {
    coverDraw(g, m, m.videoWidth || m.naturalWidth, m.videoHeight || m.naturalHeight, w, h);
  }
  const shade = g.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, 'rgba(0,0,0,0.4)');
  shade.addColorStop(0.26, 'rgba(0,0,0,0)');
  shade.addColorStop(0.48, 'rgba(0,0,0,0.05)');
  shade.addColorStop(1, 'rgba(0,0,0,0.66)');
  g.fillStyle = shade;
  g.fillRect(0, 0, w, h);
  const pad = w * 0.07;
  const small = Math.round(w * 0.024);
  g.fillStyle = p.textColor;
  g.globalAlpha = 0.6;
  g.textBaseline = 'top';
  g.font = '500 ' + small + 'px ui-monospace, "SF Mono", Menlo, monospace';
  g.letterSpacing = Math.round(small * 0.14) + 'px';
  g.textAlign = 'left';
  g.fillText(String(p.label).toUpperCase(), pad, pad);
  g.textAlign = 'right';
  g.fillText(String(f.n).padStart(2, '0') + ' / ' + String(f.total).padStart(2, '0'), w - pad, pad);
  g.globalAlpha = 0.35;
  g.fillRect(pad, h * 0.68, w - 2 * pad, Math.max(1, w * 0.0016));
  g.globalAlpha = 1;
  g.textAlign = 'left';
  const big = Math.round(w * 0.105);
  g.font = p.fontWeight + ' ' + big + 'px ' + fontOf(p);
  g.letterSpacing = Math.round(p.tracking * big) + 'px';
  g.fillText(f.title, pad, h * 0.715, w - 2 * pad);
  g.globalAlpha = 0.72;
  g.font = '400 ' + Math.round(w * 0.03) + 'px ' + fontOf(p);
  g.letterSpacing = '0px';
  g.fillText(f.caption, pad, h * 0.715 + big * 1.22, w - 2 * pad);
  g.globalAlpha = 1;
  f.texture.needsUpdate = true;
};

const makeFace = (p, layout, item, text) => {
  const c = document.createElement('canvas');
  c.width = FACE_PIXELS;
  c.height = Math.round((FACE_PIXELS * layout.faceH) / layout.faceW);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = world.renderer.capabilities.getMaxAnisotropy();
  const face = { g: c.getContext('2d'), width: c.width, height: c.height, texture, ...text, media: null, video: null, stamp: '' };
  if (!item) {
    return face;
  }
  const node = item.video ? document.createElement('video') : new Image();
  if (item.video) {
    node.muted = true;
    node.playsInline = true;
    node.preload = 'auto';
    face.video = node;
  }
  node.src = item.src;
  face.media = node;
  return face;
};

const mediaReady = (m) => Boolean(m && (m.videoWidth || (m.complete && m.naturalWidth)));

const refresh = (face, p) => {
  const stamp = [mediaReady(face.media), document.fonts.status, face.video ? face.video.currentTime : 0].join();
  if (stamp === face.stamp) {
    return;
  }
  face.stamp = stamp;
  paintFace(face, p);
};

const faceMaterial = (texture) => new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });

const disposeTile = (tile) => {
  tile.face.material.dispose();
  tile.slab.material.dispose();
};

const buildTiles = (p, layout, frame) => {
  const key = JSON.stringify([p.media, p.titles, p.captions, p.label, p.font, p.fontWeight, p.tracking, p.textColor, p.placeholderColor, layout.rows.map((r) => r.slots), cache.layoutKey]);
  if (key === cache.tilesKey) {
    return cache.tiles;
  }
  const items = mediaList(p.media);
  const titles = listOf(p.titles, ',');
  const captions = listOf(p.captions, '|');
  const kinds = Math.max(1, items.length, titles.length);
  cache.faces.forEach((f) => f.texture.dispose());
  cache.tiles.forEach(disposeTile);
  const at = (list, i) => (list.length ? list[i % list.length] : '');
  const total = Math.max(1, titles.length);
  const faces = Array.from({ length: kinds }, (_, i) => makeFace(p, layout, items.length ? items[i % items.length] : null, { title: at(titles, i), caption: at(captions, i), n: (i % total) + 1, total }));
  world.wall.clear();
  const tiles = frame.tiles.map((tile) => {
    const group = new THREE.Group();
    const face = new THREE.Mesh(layout.face, faceMaterial(faces[tile.item % kinds].texture));
    const slab = new THREE.Mesh(layout.slab, Object.assign(world.glass.clone(), { thickness: layout.depth, attenuationDistance: layout.depth * ATTENUATION_DEPTHS }));
    group.add(face, slab);
    world.wall.add(group);
    return { group, face, slab };
  });
  cache = { ...cache, tilesKey: key, tiles, faces };
  return tiles;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.glass]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  scene.style.setProperty('--gt-bg', p.background);
  world.scene.background = new THREE.Color(p.background);
  cache = { ...cache, glass: Math.max(0, p.glass) };
};

const target = new THREE.Vector3();

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const layout = layoutFor(p);
  const f = wallFrame(layout, p, t, duration);
  const tiles = buildTiles(p, layout, f);
  paintLook(p);

  const orbit = orbitAt(p, t, duration);
  const d = layout.distance;
  world.camera.position.set(d * Math.sin(orbit.yaw) * Math.cos(orbit.pitch), d * Math.sin(orbit.pitch), d * Math.cos(orbit.yaw) * Math.cos(orbit.pitch));
  world.camera.lookAt(0, 0, 0);
  world.camera.updateMatrixWorld();

  f.tiles.forEach((c, i) => {
    const { group, face, slab } = tiles[i];
    group.visible = c.shown;
    if (!c.shown) {
      return;
    }
    slab.material.color.setScalar(1 - SIDE_DIM * c.reflect * Math.min(1, cache.glass));
    slab.material.envMapIntensity = cache.glass * (1 + SIDE_GLARE * c.reflect);
    group.position.set(c.x, -c.y, c.z);
    target.set(2 * c.x, -2 * c.y, 2 * c.z + layout.radius);
    group.lookAt(target);
  });

  cache.faces.forEach((face) => {
    seekVideo(face.video, t);
    refresh(face, p);
  });
  world.renderer.render(world.scene, world.camera);
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
