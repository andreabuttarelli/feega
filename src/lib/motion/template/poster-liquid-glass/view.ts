export const POSTER_GLASS_VIEW = String.raw`
const MEASURE_PX = 100;
const RIM = 0.028;
const STEEPEST = 1.6;
const EDGE_CALM = 0.35;
const BEND = 0.04;
const SPREAD = [1, 1.025, 1.05];
const SHADOW_SHIFT = [0.006, 0.014];
const SHADOW_SOFT = 0.03;
const SHADOW_DEPTH = 0.06;
const CLIP_SPOTS = [0.045, 0.955];

root.insertAdjacentHTML('beforeend', '<div class="plg"><canvas class="plg-canvas"></canvas></div>');

const scene = root.querySelector('.plg');
const canvas = root.querySelector('.plg-canvas');
const paper = document.createElement('canvas');
const ink = paper.getContext('2d');

const nodeCount = blobNodes({ glassSize: 1, flow: 1, wander: 0, seed: 0 }, 0, 1).length;

const capsules = BLOB_EDGES.map(([a, b]) => 'd = smin(d, capsule(p, uNodes[' + a + '], uNodes[' + b + ']), MELT);').join('\n  ');
const droplets = DROPS.map((_, i) => 'd = smin(d, length(p - uNodes[' + (BODY_COUNT + i) + '].xy) - uNodes[' + (BODY_COUNT + i) + '].z, MELT);').join('\n  ');

const FRAGMENT = [
  'precision highp float;',
  'uniform sampler2D uPaper;',
  'uniform vec2 uRes;',
  'uniform vec4 uPoster;',
  'uniform vec3 uNodes[' + nodeCount + '];',
  'uniform float uBend;',
  'uniform float uShine;',
  'varying vec2 vUv;',
  'const float MELT = ' + MELT.toFixed(4) + ';',
  'const float RIM = ' + RIM.toFixed(4) + ';',
  'float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }',
  'float capsule(vec2 p, vec3 a, vec3 b) { vec2 pa = p - a.xy; vec2 ba = b.xy - a.xy; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - mix(a.z, b.z, h); }',
  'float field(vec2 p) {',
  '  float d = 1e3;',
  '  ' + capsules,
  '  ' + droplets,
  '  return d;',
  '}',
  'float lift(float d) { float x = clamp(-d / RIM, 0.0, 1.0); return 1.0 - (1.0 - x) * (1.0 - x); }',
  'vec2 capped(vec2 s) { float m = length(s); return m > ' + STEEPEST.toFixed(2) + ' ? s * (' + STEEPEST.toFixed(2) + ' / m) : s; }',
  'vec3 paperAt(vec2 px) { return texture2D(uPaper, vec2(px.x / uRes.x, 1.0 - px.y / uRes.y)).rgb; }',
  'void main() {',
  '  vec2 px = vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y);',
  '  vec2 p = (px - uPoster.xy) / uPoster.z;',
  '  float pixel = 1.0 / uPoster.z;',
  '  float d = field(p);',
  '  vec3 base = paperAt(px);',
  '  float shade = 1.0 - ' + SHADOW_DEPTH.toFixed(3) + ' * (1.0 - smoothstep(-0.01, ' + SHADOW_SOFT.toFixed(3) + ', field(p - vec2(' + SHADOW_SHIFT[0].toFixed(4) + ', ' + SHADOW_SHIFT[1].toFixed(4) + '))));',
  '  if (d > pixel * 2.0) { gl_FragColor = vec4(base * shade, 1.0); return; }',
  '  float e = pixel * 1.5;',
  '  float h = lift(d);',
  '  vec2 slope = vec2(lift(field(p + vec2(e, 0.0))) - h, lift(field(p + vec2(0.0, e))) - h) / e * RIM;',
  '  vec2 bend = capped(slope) * smoothstep(0.0, ' + EDGE_CALM.toFixed(3) + ', h);',
  '  vec2 inward = bend * uBend * ' + BEND.toFixed(4) + ' * uPoster.z;',
  '  vec3 bent = vec3(paperAt(px + inward * ' + SPREAD[0].toFixed(3) + ').r, paperAt(px + inward * ' + SPREAD[1].toFixed(3) + ').g, paperAt(px + inward * ' + SPREAD[2].toFixed(3) + ').b);',
  '  vec3 n = normalize(vec3(-bend * 0.6, 1.0));',
  '  vec3 light = normalize(vec3(-0.45, -0.7, 0.55));',
  '  float spec = pow(max(dot(n, normalize(light + vec3(0.0, 0.0, 1.0))), 0.0), 120.0);',
  '  float rim = 1.0 - n.z;',
  '  float caustic = max(dot(normalize(slope + 1e-5), normalize(light.xy)), 0.0) * (1.0 - h);',
  '  vec3 glass = bent * (1.0 - 0.35 * rim) + vec3(0.85 * spec + 0.12 * caustic) * uShine;',
  '  float inside = smoothstep(pixel, -pixel, d);',
  '  gl_FragColor = vec4(mix(base * shade, min(glass, vec3(1.0)), inside), 1.0);',
  '}'
].join('\n');

const VERTEX = 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const world = (() => {
  const renderer = three.renderer(canvas);
  const texture = new THREE.CanvasTexture(paper);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uPaper: { value: texture },
      uRes: { value: new THREE.Vector2(1, 1) },
      uPoster: { value: new THREE.Vector4(0, 0, 1, 1) },
      uNodes: { value: Array.from({ length: nodeCount }, () => new THREE.Vector3()) },
      uBend: { value: 1 },
      uShine: { value: 1 }
    },
    depthTest: false,
    depthWrite: false
  });
  const plane = new THREE.PlaneGeometry(2, 2);
  const stage = new THREE.Scene();
  stage.add(new THREE.Mesh(plane, material));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return { renderer, texture, material, plane, stage, camera, buffer: new THREE.Vector2() };
})();

onDestroy(() => {
  world.plane.dispose();
  world.material.dispose();
  world.texture.dispose();
  world.renderer.dispose();
});

let cache = { sizeKey: '', paperKey: '', poster: null };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });
const fontOf = (p) => (String(p.font).includes(',') ? p.font : '"' + p.font + '", "Helvetica Neue", Helvetica, Arial, sans-serif');
const typeFace = (p, px) => p.fontWeight + ' ' + px + 'px ' + fontOf(p);

const fitBuffer = () => {
  const { width, height } = sizeOf();
  const key = width + 'x' + height;
  if (key !== cache.sizeKey) {
    world.renderer.setSize(width, height, false);
    cache = { ...cache, sizeKey: key, paperKey: '' };
  }
  world.renderer.getDrawingBufferSize(world.buffer);
  return { width: world.buffer.x, height: world.buffer.y };
};

const measure = (p, text) => {
  ink.font = typeFace(p, MEASURE_PX);
  ink.letterSpacing = p.tracking * MEASURE_PX + 'px';
  return ink.measureText(text).width / MEASURE_PX;
};

const paintClip = (x, y, size) => {
  ink.fillStyle = '#9a9a9c';
  ink.fillRect(x - size * 0.32, y - size * 0.62, size * 0.08, size * 0.5);
  ink.fillRect(x + size * 0.24, y - size * 0.62, size * 0.08, size * 0.5);
  ink.fillStyle = '#141414';
  ink.fillRect(x - size * 0.5, y - size * 0.18, size, size * 0.42);
};

const paintPaper = (p, width, height) => {
  const key = JSON.stringify([width, height, p.headline, p.intro, p.details, p.dates, p.venue, p.footer, p.font, p.fontWeight, p.tracking, p.ink, p.muted, p.paper, p.wall, p.clips]);
  if (key === cache.paperKey) {
    return cache.poster;
  }
  paper.width = width;
  paper.height = height;
  const poster = posterBox(width, height);
  ink.fillStyle = p.wall;
  ink.fillRect(0, 0, width, height);
  ink.save();
  ink.shadowColor = 'rgba(0, 0, 0, 0.18)';
  ink.shadowBlur = poster.w * 0.03;
  ink.shadowOffsetY = poster.w * 0.008;
  ink.fillStyle = p.paper;
  ink.fillRect(poster.x, poster.y, poster.w, poster.h);
  ink.restore();

  ink.textBaseline = 'alphabetic';
  posterBlocks(p, poster, (text) => measure(p, text)).forEach((b) => {
    ink.font = typeFace(p, b.size);
    ink.letterSpacing = p.tracking * b.size + 'px';
    ink.textAlign = b.align;
    ink.fillStyle = b.muted ? p.muted : p.ink;
    ink.fillText(b.text, b.align === 'right' ? b.x + p.tracking * b.size : b.x, b.y);
  });

  if (p.clips) {
    CLIP_SPOTS.forEach((at) => paintClip(poster.x + poster.w * at, poster.y, poster.w * 0.04));
  }
  world.texture.needsUpdate = true;
  cache = { ...cache, paperKey: key, poster };
  return poster;
};

const draw = () => {
  const p = { ...props };
  const { width, height } = fitBuffer();
  const poster = paintPaper(p, width, height);
  const u = world.material.uniforms;
  u.uRes.value.set(width, height);
  u.uPoster.value.set(poster.x, poster.y, poster.w, poster.h);
  blobNodes(p, tl.time(), duration).forEach(([x, y, r], i) => u.uNodes.value[i].set(x, y, r));
  u.uBend.value = p.refraction;
  u.uShine.value = p.shine;
  world.renderer.render(world.stage, world.camera);
};

draw();
if (document.fonts) {
  document.fonts.load(typeFace(props, MEASURE_PX)).then(() => {
    cache = { ...cache, paperKey: '' };
    draw();
  });
}
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;
