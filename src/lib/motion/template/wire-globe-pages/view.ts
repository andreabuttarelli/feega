import { MEDIA_LIST } from '../media-list';

export const WIRE_VIEW = String.raw`
${MEDIA_LIST}
const FOV = 30;
const PAGE_SEGMENTS = 20;
const CIRCLE_SEGMENTS = 192;
const WIRE_RADIUS = 1;

const PAGE_VERTEX = 'varying vec2 vUv; varying float vFacing; void main() { vUv = uv; vec4 view = modelViewMatrix * vec4(position, 1.0); vFacing = dot(normalize(normalMatrix * normal), normalize(-view.xyz)); gl_Position = projectionMatrix * view; }';
const PAGE_FRAGMENT = 'uniform sampler2D uMap; uniform float uHas; uniform vec4 uCrop; uniform float uMono; uniform float uBack; uniform float uContrast; uniform float uBright; uniform vec3 uEmpty; uniform vec3 uBg; varying vec2 vUv; varying float vFacing; void main() { vec3 c = mix(uEmpty, texture2D(uMap, uCrop.xy * vUv + uCrop.zw).rgb, uHas); c = mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), uMono); c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0) * uBright; vec2 e = min(vUv, 1.0 - vUv); c = mix(c, vec3(0.85), 0.35 * (1.0 - smoothstep(0.0, 0.006, min(e.x, e.y)))); c = mix(c, uBg, uBack * smoothstep(0.2, -0.4, vFacing)); gl_FragColor = vec4(c, 1.0); }';
const LINE_VERTEX = 'varying float vFacing; void main() { vec4 view = modelViewMatrix * vec4(position, 1.0); vec4 centre = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); vFacing = dot(normalize(view.xyz - centre.xyz), normalize(-view.xyz)); gl_Position = projectionMatrix * view; }';
const LINE_FRAGMENT = 'uniform vec3 uColor; uniform float uOpacity; uniform float uBackLines; varying float vFacing; void main() { gl_FragColor = vec4(uColor, uOpacity * mix(uBackLines, 1.0, smoothstep(-0.15, 0.15, vFacing))); }';

root.insertAdjacentHTML('beforeend', '<div class="wg"><canvas class="wg-canvas"></canvas><div class="wg-sources"></div></div>');

const scene = root.querySelector('.wg');
const canvas = root.querySelector('.wg-canvas');
const sources = root.querySelector('.wg-sources');

const rgb = (hex) => {
  const h = String(hex || '#000000').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  return new THREE.Vector3(parseInt(full.slice(0, 2), 16) / 255, parseInt(full.slice(2, 4), 16) / 255, parseInt(full.slice(4, 6), 16) / 255);
};

const world = (() => {
  const renderer = three.renderer(canvas);
  const scene3 = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 50);
  const globe = new THREE.Group();
  globe.rotation.order = 'XYZ';
  scene3.add(globe);
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;
  const lineMaterial = new THREE.ShaderMaterial({ vertexShader: LINE_VERTEX, fragmentShader: LINE_FRAGMENT, uniforms: { uColor: { value: rgb('#a3a3a3') }, uOpacity: { value: 0.5 }, uBackLines: { value: 0.3 } }, transparent: true, depthWrite: false });
  return { renderer, scene: scene3, camera, globe, blank, lineMaterial, pages: [], lines: null, textures: [] };
})();

let cache = { sizeKey: '', layoutKey: '', linesKey: '', mediaKey: '', items: [], lookKey: '', look: null };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const fit = (p, width, height) => {
  const key = JSON.stringify([width, height, p.radius]);
  if (key === cache.sizeKey) {
    return;
  }
  cache = { ...cache, sizeKey: key };
  const tan = Math.tan((FOV * Math.PI) / 360);
  const reach = height / (2 * p.radius * Math.min(width, height) * tan);
  world.renderer.setSize(width, height, false);
  world.camera.aspect = width / height;
  world.camera.position.set(0, 0, Math.sqrt(1 + reach * reach));
  world.camera.updateProjectionMatrix();
};

const circle = (points, at) => {
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    points.push(...at(i / CIRCLE_SEGMENTS), ...at((i + 1) / CIRCLE_SEGMENTS));
  }
};

const buildLines = (p) => {
  const key = String(p.gridStep);
  if (key === cache.linesKey) {
    return;
  }
  cache = { ...cache, linesKey: key };
  if (world.lines) {
    world.globe.remove(world.lines);
    world.lines.geometry.dispose();
  }
  const step = Math.max(1, p.gridStep) * (Math.PI / 180);
  const points = [];
  for (let lat = -Math.PI / 2 + step; lat < Math.PI / 2 - 1e-6; lat += step) {
    circle(points, (k) => [WIRE_RADIUS * Math.cos(lat) * Math.sin(k * 2 * Math.PI), WIRE_RADIUS * Math.sin(lat), WIRE_RADIUS * Math.cos(lat) * Math.cos(k * 2 * Math.PI)]);
  }
  for (let lon = 0; lon < Math.PI - 1e-6; lon += step) {
    circle(points, (k) => [WIRE_RADIUS * Math.sin(k * 2 * Math.PI) * Math.sin(lon), WIRE_RADIUS * Math.cos(k * 2 * Math.PI), WIRE_RADIUS * Math.sin(k * 2 * Math.PI) * Math.cos(lon)]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  world.lines = new THREE.LineSegments(geometry, world.lineMaterial);
  world.lines.renderOrder = 1;
  world.globe.add(world.lines);
};

const pageGeometry = (page) => {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let j = 0; j <= PAGE_SEGMENTS; j++) {
    for (let i = 0; i <= PAGE_SEGMENTS; i++) {
      const u = i / PAGE_SEGMENTS;
      const v = j / PAGE_SEGMENTS;
      positions.push(...pagePoint(page, u, v));
      uvs.push(u, v);
    }
  }
  const row = PAGE_SEGMENTS + 1;
  for (let j = 0; j < PAGE_SEGMENTS; j++) {
    for (let i = 0; i < PAGE_SEGMENTS; i++) {
      const a = j * row + i;
      indices.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(positions.map((x, i) => x / page.r), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
};

const buildPages = (p) => {
  const key = JSON.stringify([p.pages, p.pageSize, p.pageAspect]);
  if (key === cache.layoutKey) {
    return;
  }
  cache = { ...cache, layoutKey: key };
  world.pages.forEach((page) => {
    world.globe.remove(page.mesh);
    page.mesh.geometry.dispose();
    page.mesh.material.dispose();
  });
  world.pages = pageLayout(p).map((page) => {
    const material = new THREE.ShaderMaterial({
      vertexShader: PAGE_VERTEX,
      fragmentShader: PAGE_FRAGMENT,
      side: THREE.DoubleSide,
      uniforms: { uMap: { value: world.blank }, uHas: { value: 0 }, uCrop: { value: new THREE.Vector4(1, 1, 0, 0) }, uMono: { value: 1 }, uBack: { value: 0.7 }, uContrast: { value: 1 }, uBright: { value: 1 }, uEmpty: { value: rgb('#2b2b2b') }, uBg: { value: rgb('#0d0d0d') } }
    });
    const mesh = new THREE.Mesh(pageGeometry(page), material);
    mesh.matrixAutoUpdate = false;
    world.globe.add(mesh);
    return { mesh, aspect: page.w / page.h, slot: page.slot };
  });
};

const sourceHtml = (item) => (item.video ? '<video muted playsinline preload="auto" src="' + item.src + '"></video>' : '<img decoding="sync" src="' + item.src + '">');

const buildMedia = (p) => {
  const key = JSON.stringify(p.media);
  if (key === cache.mediaKey) {
    return cache.items;
  }
  world.textures.forEach((tex) => tex.dispose());
  sources.innerHTML = '';
  const items = mediaList(p.media).map((item) => {
    sources.insertAdjacentHTML('beforeend', sourceHtml(item));
    const el = sources.lastElementChild;
    const texture = new THREE.Texture(el);
    texture.minFilter = item.video ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = !item.video;
    texture.anisotropy = 4;
    const entry = { el, texture, video: item.video, ready: false, aspect: 1 };
    if (item.video) {
      el.addEventListener('loadeddata', () => draw());
    } else {
      el.addEventListener('load', () => draw());
    }
    return entry;
  });
  world.textures = items.map((i) => i.texture);
  cache = { ...cache, mediaKey: key, items };
  return items;
};

const refresh = (item, t) => {
  if (item.video) {
    seekVideo(item.el, t);
    if (item.el.readyState >= 2 && item.el.videoWidth) {
      item.aspect = item.el.videoWidth / item.el.videoHeight;
      item.texture.needsUpdate = true;
      item.ready = true;
    }
    return;
  }
  if (!item.ready && item.el.complete && item.el.naturalWidth) {
    item.aspect = item.el.naturalWidth / item.el.naturalHeight;
    item.texture.needsUpdate = true;
    item.ready = true;
  }
};

const crop = (target, page, item) => {
  if (item.aspect > page.aspect) {
    const sx = page.aspect / item.aspect;
    target.set(sx, 1, (1 - sx) / 2, 0);
    return;
  }
  const sy = item.aspect / page.aspect;
  target.set(1, sy, 0, (1 - sy) / 2);
};

const look = (p) => {
  const key = JSON.stringify([p.background, p.emptyColor, p.lineColor]);
  if (key === cache.lookKey) {
    return cache.look;
  }
  const colours = { bg: rgb(p.background), empty: rgb(p.emptyColor), line: rgb(p.lineColor) };
  scene.style.setProperty('--wg-bg', p.background);
  world.renderer.setClearColor(new THREE.Color().setRGB(colours.bg.x, colours.bg.y, colours.bg.z, THREE.SRGBColorSpace), 1);
  cache = { ...cache, lookKey: key, look: colours };
  return colours;
};

const paint = (p, items) => {
  const { bg, empty, line } = look(p);
  world.lineMaterial.uniforms.uColor.value = line;
  world.lineMaterial.uniforms.uOpacity.value = p.lineOpacity;
  world.lineMaterial.uniforms.uBackLines.value = p.backLines;
  world.pages.forEach((page) => {
    const u = page.mesh.material.uniforms;
    const item = items.length ? items[page.slot % items.length] : null;
    const ready = Boolean(item && item.ready);
    u.uMap.value = ready ? item.texture : world.blank;
    u.uHas.value = ready ? 1 : 0;
    if (ready) {
      crop(u.uCrop.value, page, item);
    }
    u.uMono.value = p.monochrome ? 1 : 0;
    u.uBack.value = p.backDim;
    u.uContrast.value = p.contrast;
    u.uBright.value = p.brightness;
    u.uEmpty.value = empty;
    u.uBg.value = bg;
  });
};

onDestroy(() => {
  world.pages.forEach((page) => {
    page.mesh.geometry.dispose();
    page.mesh.material.dispose();
  });
  if (world.lines) {
    world.lines.geometry.dispose();
  }
  world.lineMaterial.dispose();
  world.textures.forEach((tex) => tex.dispose());
  world.blank.dispose();
  world.renderer.dispose();
});

function draw() {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  fit(p, width, height);
  buildLines(p);
  buildPages(p);
  const items = buildMedia(p);
  items.forEach((item) => refresh(item, t));
  paint(p, items);
  const f = wireFrame(p, t, duration);
  world.globe.rotation.set(f.tilt + f.pitch, f.yaw, 0);
  world.renderer.render(world.scene, world.camera);
}

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
