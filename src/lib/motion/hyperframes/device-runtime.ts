import { DEVICE, FINISH_COLOR, Finish, BEVEL, GLASS_RIM, SCREEN, type Device, type DeviceSpec } from '../devices';
import { DEVICE_SCENE } from '../keyframes';

export type DeviceRuntime = DeviceSpec & { color: string; safeTop: number };

export function deviceRuntime(device: Device, finish: Finish, ctx: { color: (v: string) => string }): DeviceRuntime {
  const spec = DEVICE[device];
  const FINISH_OF: Record<Finish, () => string> = {
    [Finish.Default]: () => spec.finish,
    [Finish.Brand]: () => ctx.color('brand.primary'),
    [Finish.Black]: () => FINISH_COLOR[Finish.Black],
    [Finish.Silver]: () => FINISH_COLOR[Finish.Silver],
    [Finish.White]: () => FINISH_COLOR[Finish.White]
  };
  return { ...spec, color: FINISH_OF[finish](), safeTop: SCREEN[device].safeTop };
}

export const DEVICE_SCRIPT = `
const DEVICE_LID = ${DEVICE_SCENE.lid.fallback};
const DEVICE_FOLD = ${DEVICE_SCENE.fold.fallback};
const FOLD_GAP = 0.9;
const SCREEN_TEXTURE_MAX = 1024;
const LAYER_GAP = 0.0012;
const SCREEN_REFLECTION = 0.03;
const LIFT = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
const GLASS = { color: 0x050506, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04 };

function roundedRect(w, h, r) {
  const x = -w / 2, y = -h / 2, k = Math.min(r, w / 2, h / 2);
  const shape = new THREE.Shape();
  shape.moveTo(x + k, y);
  shape.lineTo(x + w - k, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + k);
  shape.lineTo(x + w, y + h - k);
  shape.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
  shape.lineTo(x + k, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - k);
  shape.lineTo(x, y + k);
  shape.quadraticCurveTo(x, y, x + k, y);
  return shape;
}

function halfRect(w, h, r, side) {
  const k = Math.min(r, w, h / 2), y = -h / 2;
  const outer = side * w;
  const shape = new THREE.Shape();
  shape.moveTo(0, y);
  shape.lineTo(outer - side * k, y);
  shape.quadraticCurveTo(outer, y, outer, y + k);
  shape.lineTo(outer, -y - k);
  shape.quadraticCurveTo(outer, -y, outer - side * k, -y);
  shape.lineTo(0, -y);
  shape.lineTo(0, y);
  return shape;
}

function flat(shape, w, h) {
  const geo = new THREE.ShapeGeometry(shape, 24);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return geo;
}

const bevelOf = (d) => Math.min(d * ${BEVEL.share}, ${BEVEL.max});

function slab(w, h, d, r, material, outline = roundedRect) {
  const bevel = bevelOf(d);
  const geo = new THREE.ExtrudeGeometry(outline(w - bevel * 1.6, h - bevel * 1.6, Math.max(r - bevel * 0.8, 0.5)), { depth: Math.max(d - bevel * 2, 0.1), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 6, curveSegments: 24 });
  geo.translate(0, 0, -d / 2 + bevel);
  return new THREE.Mesh(geo, material);
}

function plate(shape, w, h, z, material) {
  const mesh = new THREE.Mesh(flat(shape, w, h), material);
  mesh.position.z = z;
  return mesh;
}

function frameMaterial(spec) {
  return new THREE.MeshPhysicalMaterial({ color: new THREE.Color(spec.color), metalness: 0.85, roughness: 0.32, clearcoat: 0.3 });
}

function screenCanvas(spec) {
  const [pw, ph] = spec.screen.px;
  const scale = SCREEN_TEXTURE_MAX / Math.max(pw, ph);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(pw * scale);
  canvas.height = Math.round(ph * scale);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, texture, ctx: canvas.getContext('2d') };
}

function drawScreen(slot, source, scroll, fit, safeTop) {
  const { canvas, ctx, texture } = slot;
  const key = screenKey(source, scroll);
  if (slot.key === key) return;
  slot.key = key;
  ctx.fillStyle = '#0b0b0c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const width = source && (source.videoWidth || source.naturalWidth || source.width);
  const height = source && (source.videoHeight || source.naturalHeight || source.height);
  if (width && height) {
    const p = screenPlacement({ width, height }, canvas, fit, scroll, safeTop);
    ctx.drawImage(source, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);
  }
  texture.needsUpdate = true;
}

function frontFace(spec, group, front) {
  const { body, screen } = spec;
  const rim = ${GLASS_RIM};
  const step = Math.max(body.width, body.height) * LAYER_GAP;
  group.add(plate(roundedRect(body.width - rim * 2, body.height - rim * 2, body.radius - rim), body.width, body.height, front + step, new THREE.MeshPhysicalMaterial(GLASS)));
  const slot = screenCanvas(spec);
  const screenShape = roundedRect(screen.width, screen.height, screen.radius);
  const display = plate(screenShape, screen.width, screen.height, front + step * 2, new THREE.MeshBasicMaterial({ map: slot.texture, toneMapped: false, ...LIFT }));
  display.position.y = screen.offsetY;
  group.add(display);
  const reflection = plate(screenShape, screen.width, screen.height, front + step * 3, new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.06, metalness: 0, specularIntensity: SCREEN_REFLECTION, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, ...LIFT }));
  reflection.position.y = screen.offsetY;
  group.add(reflection);
  CUTOUT[spec.cutout.kind](spec, group, front + step * 4);
  return slot;
}

const BLACK = () => new THREE.MeshBasicMaterial({ color: 0x000000, ...LIFT });

const CUTOUT = {
  none: () => {},
  island: (spec, group, z) => {
    const c = spec.cutout;
    const pill = plate(roundedRect(c.width, c.height, c.height / 2), c.width, c.height, z, BLACK());
    pill.position.y = spec.screen.offsetY + spec.screen.height / 2 - c.top - c.height / 2;
    group.add(pill);
  },
  punch: (spec, group, z) => {
    const c = spec.cutout;
    const dot = new THREE.Mesh(new THREE.CircleGeometry(c.width / 2, 32), BLACK());
    dot.position.set(0, spec.screen.offsetY + spec.screen.height / 2 - c.top - c.height / 2, z);
    group.add(dot);
  },
  notch: (spec, group, z) => {
    const c = spec.cutout;
    const notch = plate(roundedRect(c.width, c.height * 2, c.height * 0.5), c.width, c.height * 2, z, BLACK());
    notch.position.y = spec.screen.offsetY + spec.screen.height / 2;
    group.add(notch);
  }
};

function lens(r, depth, x, y, z) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, depth, 64), new THREE.MeshPhysicalMaterial({ color: 0x8a8a8f, metalness: 1, roughness: 0.25 }));
  ring.rotation.x = Math.PI / 2;
  const glass = new THREE.Mesh(new THREE.CircleGeometry(r * 0.72, 64), new THREE.MeshPhysicalMaterial({ color: 0x07070a, roughness: 0.02, clearcoat: 1, metalness: 0.2 }));
  glass.position.z = -depth / 2 - 0.02;
  glass.rotation.y = Math.PI;
  group.add(ring, glass);
  group.position.set(x, y, z - depth / 2);
  return group;
}

const CAMERA = {
  none: () => {},
  'pro-plateau': (spec, group, back, material) => {
    const w = spec.body.width - 1.2, h = 44, d = 1.4;
    const fromTop = (y) => spec.body.height / 2 - y;
    const plateau = slab(w, h, d, spec.body.radius - 0.6, material);
    plateau.position.set(0, fromTop(0.6 + h / 2), back - d / 2);
    group.add(plateau);
    [[21.7, 14.2], [21.7, 34], [3, 23.6]].forEach(([x, y]) => group.add(lens(8, 2.4, x, fromTop(y), back - d)));
    [[3, 7], [3, 39]].forEach(([x, y]) => group.add(lens(2.2, 0.4, x - 8.5, fromTop(y), back - d)));
  },
  'dual-pill': (spec, group, back, material) => {
    const w = 19, h = 38, d = 1.2;
    const pill = slab(w, h, d, w / 2, material);
    const x = spec.body.width / 2 - 6 - w / 2, y = spec.body.height / 2 - 6 - h / 2;
    pill.position.set(x, y, back - d / 2);
    group.add(pill);
    group.add(lens(6, 1.8, x, y + 9, back - d), lens(6, 1.8, x, y - 9, back - d));
  },
  visor: (spec, group, back, material) => {
    const y = spec.body.height / 2 - 26;
    const ring = slab(spec.body.width - 2, 21, 2.2, 10.5, material);
    ring.position.set(0, y, back - 1.1);
    group.add(ring);
    const glass = slab(spec.body.width - 14, 16, 3.2, 8, new THREE.MeshPhysicalMaterial({ color: 0x0a0a0c, metalness: 0.2, roughness: 0.08, clearcoat: 1 }));
    glass.position.set(5, y, back - 1.6);
    group.add(glass);
    [22, 10, -2].forEach((x) => group.add(lens(5, 0.6, x, y, back - 3.2)));
    group.add(lens(2.4, 0.3, -27, y, back - 2.2));
  },
  single: (spec, group, back) => {
    group.add(lens(5, 1.4, spec.body.width / 2 - 12, spec.body.height / 2 - 12, back));
  }
};

function buttons(spec, group, material) {
  const t = spec.body.depth * 0.38;
  for (const b of spec.buttons) {
    const button = new THREE.Mesh(new THREE.BoxGeometry(1.2, b.length, t), material);
    const x = (spec.body.width / 2 + 0.3) * (b.side === 'left' ? -1 : 1);
    button.position.set(x, spec.body.height / 2 - b.top - b.length / 2, 0);
    group.add(button);
  }
}

function handheld(spec) {
  const group = new THREE.Group();
  const material = frameMaterial(spec);
  group.add(slab(spec.body.width, spec.body.height, spec.body.depth, spec.body.radius, material));
  const back = plate(roundedRect(spec.body.width - 1.4, spec.body.height - 1.4, spec.body.radius - 0.7), spec.body.width, spec.body.height, -spec.body.depth / 2 - 0.02, new THREE.MeshPhysicalMaterial({ color: new THREE.Color(spec.color), roughness: 0.45, metalness: 0.1, clearcoat: 0.6 }));
  back.rotation.y = Math.PI;
  group.add(back);
  CAMERA[spec.camera](spec, group, -spec.body.depth / 2 - 0.02, material);
  buttons(spec, group, material);
  const slot = frontFace(spec, group, spec.body.depth / 2);
  return { root: group, slot, lid: null };
}

function keyboard(spec, base, top) {
  const deck = new THREE.Group();
  const kw = spec.body.width * 0.84, kd = spec.base.depth * 0.42;
  const well = new THREE.Mesh(new THREE.PlaneGeometry(kw, kd), new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.8 }));
  well.rotation.x = -Math.PI / 2;
  well.position.set(0, top + 0.02, -spec.base.depth / 2 + 14 + kd / 2);
  deck.add(well);
  const cols = 14, rows = 6, pitch = kw / cols;
  const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(pitch * 0.82, 0.6, (kd / rows) * 0.8), new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.6 }), cols * rows);
  const m = new THREE.Matrix4();
  let n = 0;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    m.makeTranslation(-kw / 2 + pitch * (k + 0.5), top + 0.35, well.position.z - kd / 2 + (kd / rows) * (r + 0.5));
    keys.setMatrixAt(n++, m);
  }
  deck.add(keys);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(spec.body.width * 0.42, spec.base.depth * 0.3), new THREE.MeshPhysicalMaterial({ color: new THREE.Color(spec.color).multiplyScalar(0.92), roughness: 0.35, metalness: 0.6 }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, top + 0.02, spec.base.depth / 2 - 6 - spec.base.depth * 0.15);
  deck.add(pad);
  base.add(deck);
}

function laptop(spec) {
  const root = new THREE.Group();
  const material = frameMaterial(spec);
  const base = new THREE.Group();
  const deck = slab(spec.body.width, spec.base.depth, spec.base.thickness, spec.body.radius, material);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = spec.base.thickness / 2;
  base.add(deck);
  keyboard(spec, base, spec.base.thickness);
  root.add(base);
  const hinge = new THREE.Group();
  hinge.position.set(0, spec.base.thickness, -spec.base.depth / 2 + 2);
  const lid = new THREE.Group();
  const shell = slab(spec.body.width, spec.body.height, spec.body.depth, spec.body.radius, material);
  lid.add(shell);
  const slot = frontFace(spec, lid, spec.body.depth / 2);
  lid.position.set(0, spec.body.height / 2, spec.body.depth / 2);
  hinge.add(lid);
  root.add(hinge);
  return { root, slot, lid: hinge };
}

function monitor(spec) {
  const root = new THREE.Group();
  const material = frameMaterial(spec);
  const panel = new THREE.Group();
  panel.add(slab(spec.body.width, spec.body.height, spec.body.depth, spec.body.radius, material));
  const slot = frontFace(spec, panel, spec.body.depth / 2);
  const centre = spec.stand.height - spec.body.height / 2;
  panel.position.y = centre;
  root.add(panel);
  const foot = slab(spec.stand.footWidth, spec.stand.footDepth, 6, 6, material);
  foot.rotation.x = -Math.PI / 2;
  foot.position.set(0, 3, -spec.stand.footDepth / 2 + 20);
  root.add(foot);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(spec.stand.footWidth * 0.9, centre + 40, 7), material);
  arm.position.set(0, (centre + 40) / 2, -spec.body.depth / 2 - 18);
  arm.rotation.x = -0.12;
  root.add(arm);
  return { root, slot, lid: null };
}

function browser(spec) {
  const group = new THREE.Group();
  const body = slab(spec.body.width, spec.body.height, spec.body.depth, spec.body.radius, new THREE.MeshPhysicalMaterial({ color: new THREE.Color(spec.color), roughness: 0.5 }));
  group.add(body);
  const bar = spec.body.height - spec.screen.height;
  const top = spec.body.height / 2 - bar / 2;
  ['#ff5f57', '#febc2e', '#28c840'].forEach((hex, i) => {
    const dot = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), new THREE.MeshBasicMaterial({ color: hex }));
    dot.position.set(-spec.body.width / 2 + 8 + i * 5.5, top, spec.body.depth / 2 + 0.05);
    group.add(dot);
  });
  const address = plate(roundedRect(spec.body.width * 0.45, bar * 0.6, bar * 0.3), 1, 1, spec.body.depth / 2 + 0.05, new THREE.MeshBasicMaterial({ color: 0xe6e6e3 }));
  address.position.y = top;
  group.add(address);
  const slot = screenCanvas(spec);
  const display = plate(roundedRect(spec.screen.width, spec.screen.height, 0.01), spec.screen.width, spec.screen.height, spec.body.depth / 2 + 0.05, new THREE.MeshBasicMaterial({ map: slot.texture, toneMapped: false }));
  display.position.y = spec.screen.offsetY;
  group.add(display);
  return { root: group, slot, lid: null };
}

function leaf(spec, side, material, slot) {
  const { body, screen } = spec;
  const half = new THREE.Group();
  const w = body.width / 2;
  const shell = slab(w, body.height, body.depth, body.radius, material, (sw, sh, r) => halfRect(sw, sh, r, side));
  shell.position.set(side * bevelOf(body.depth) * 0.8, 0, -body.depth / 2);
  half.add(shell);
  const step = Math.max(body.width, body.height) * LAYER_GAP;
  half.add(plate(halfRect(w - 0.7, body.height - 1.4, body.radius - 0.7, side), body.width, body.height, step, new THREE.MeshPhysicalMaterial(GLASS)));
  const display = plate(halfRect(screen.width / 2, screen.height, screen.radius, side), screen.width, screen.height, step * 2, new THREE.MeshBasicMaterial({ map: slot.texture, toneMapped: false, ...LIFT }));
  half.add(display);
  const back = plate(halfRect(w - 0.7, body.height - 1.4, body.radius - 0.7, -side), body.width, body.height, -body.depth - 0.02, side < 0 ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color(spec.color), roughness: 0.45, metalness: 0.1, clearcoat: 0.6 }) : new THREE.MeshPhysicalMaterial(GLASS));
  back.rotation.y = Math.PI;
  half.add(back);
  return half;
}

function foldable(spec) {
  const root = new THREE.Group();
  const material = frameMaterial(spec);
  const slot = screenCanvas(spec);
  const right = leaf(spec, 1, material, slot);
  root.add(right);
  const hinge = new THREE.Group();
  hinge.position.x = -FOLD_GAP / 2;
  const left = leaf(spec, -1, material, slot);
  const lens = new THREE.Group();
  CAMERA[spec.camera]({ ...spec, body: { ...spec.body, width: spec.body.width / 2 } }, lens, -spec.body.depth - 0.02, material);
  lens.position.x = -spec.body.width / 4;
  lens.scale.x = -1;
  left.add(lens);
  hinge.add(left);
  right.position.x = FOLD_GAP / 2;
  root.add(hinge);
  return { root, slot, lid: null, fold: hinge };
}

const BUILD = { phone: handheld, foldable, tablet: handheld, laptop, monitor, browser };

function deviceSource(c, s) {
  const video = document.getElementById('dv-' + c.id);
  if (video) {
    const frame = video.nextElementSibling;
    if (frame && frame.classList.contains('__render_frame__') && frame.complete && frame.naturalWidth) return frame;
    return video.readyState >= 2 ? video : null;
  }
  return s.screenImage;
}

function setLid(s, angle) {
  if (s.device.lid) s.device.lid.rotation.x = (90 - angle) * DEG;
}

function setFold(s, angle) {
  if (s.device.fold) s.device.fold.rotation.y = (180 - angle) * DEG;
}

function loadDevice(c, s) {
  const built = BUILD[c.device.kind](c.device);
  s.device = built;
  setLid(s, DEVICE_LID);
  setFold(s, DEVICE_FOLD);
  finish(built.root, { surface: null });
  s.object.add(fitted(built.root));
  if (c.video) {
    const video = document.getElementById('dv-' + c.id);
    const again = () => redraw();
    video.addEventListener('seeked', again);
    video.addEventListener('loadeddata', again);
    new MutationObserver(() => {
      const frame = video.nextElementSibling;
      if (frame && frame.classList.contains('__render_frame__')) frame.decode().then(again, () => {});
    }).observe(video.parentNode, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    return Promise.resolve();
  }
  if (!c.url) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { s.screenImage = img; resolve(); };
    img.onerror = () => resolve();
    img.src = c.url;
  });
}

function updateDevice(c, s, at) {
  if (!s.device) return;
  setLid(s, at('lid', DEVICE_LID));
  setFold(s, at('fold', DEVICE_FOLD));
  drawScreen(s.device.slot, deviceSource(c, s), at('screenScroll', 0), c.screenFit, c.device.safeTop);
}
`;
