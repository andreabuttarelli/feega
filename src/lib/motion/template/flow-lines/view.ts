import { FIELD_FRAGMENT, QUAD_VERTEX, STRAND, STRAND_FRAGMENT, STRAND_VERTEX } from './shaders';

export const FLOW_VIEW = String.raw`
const QUAD_VERTEX = ${JSON.stringify(QUAD_VERTEX)};
const FIELD_FRAGMENT = ${JSON.stringify(FIELD_FRAGMENT)};
const STRAND_VERTEX = ${JSON.stringify(STRAND_VERTEX)};
const STRAND_FRAGMENT = ${JSON.stringify(STRAND_FRAGMENT)};
const POINTS = ${STRAND.points};
const FIELD_LONG = 640;
const REFERENCE_SHORT = 1080;
const WIDTH_PX = 1.3;
const STRAND_REACH = 0.6;
const STRENGTH = 0.06;

root.insertAdjacentHTML('beforeend', '<div class="fl"><canvas class="fl-canvas"></canvas><div class="fl-title"><h1 class="fl-headline"></h1></div></div>');

const scene = root.querySelector('.fl');
const canvas = root.querySelector('.fl-canvas');
const headline = root.querySelector('.fl-headline');

let cache = { lookKey: '', titleKey: '', words: [], sizeKey: '', strands: 0 };

const sizeOf = () => ({ width: scene.clientWidth || 1080, height: scene.clientHeight || 1920 });

const strandGeometry = (count) => {
  const geometry = new THREE.InstancedBufferGeometry();
  const corners = new Float32Array(POINTS * 4);
  const index = [];
  for (let i = 0; i < POINTS; i++) {
    corners.set([i, -1, i, 1], i * 4);
    if (i < POINTS - 1) {
      const k = i * 2;
      index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const seeds = new Float32Array(count * 3);
  strandSeeds(count).forEach((s, i) => seeds.set([s.x, s.y, s.offset], i * 3));
  geometry.setAttribute('corner', new THREE.BufferAttribute(corners, 2));
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(POINTS * 6), 3));
  geometry.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 3));
  geometry.setIndex(index);
  geometry.instanceCount = count;
  return geometry;
};

const gpu = (() => {
  const renderer = three.renderer(canvas);
  renderer.autoClear = false;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const target = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const shared = { uSpan: { value: new THREE.Vector2(1, 1) }, uRadius: { value: 0.4 } };
  const field = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERTEX,
    fragmentShader: FIELD_FRAGMENT,
    uniforms: { ...shared, uOrbit: { value: new THREE.Vector2(1, 0) }, uFrequency: { value: 1 }, uOctave: { value: 0 } }
  });
  const lines = new THREE.ShaderMaterial({
    vertexShader: STRAND_VERTEX,
    fragmentShader: STRAND_FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      ...shared,
      uField: { value: target.texture },
      uPixels: { value: new THREE.Vector2(1, 1) },
      uStepLength: { value: 0.01 },
      uPhase: { value: 0 },
      uWidth: { value: WIDTH_PX },
      uStrength: { value: STRENGTH },
      uVeil: { value: 0 },
      uLine: { value: new THREE.Color(1, 1, 1) }
    }
  });
  const fieldScene = new THREE.Scene();
  fieldScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), field));
  const strands = new THREE.Mesh(strandGeometry(1), lines);
  strands.frustumCulled = false;
  const linesScene = new THREE.Scene();
  linesScene.add(strands);
  const background = new THREE.Color();
  return { renderer, camera, target, field, lines, fieldScene, linesScene, strands, shared, background };
})();

const fitStrands = (count) => {
  if (count === cache.strands) {
    return;
  }
  cache = { ...cache, strands: count };
  gpu.strands.geometry.dispose();
  gpu.strands.geometry = strandGeometry(count);
};

const fit = (width, height) => {
  const key = width + 'x' + height;
  if (key === cache.sizeKey) {
    return;
  }
  cache = { ...cache, sizeKey: key };
  gpu.renderer.setSize(width, height, false);
  const long = Math.max(width, height);
  gpu.target.setSize(Math.round((FIELD_LONG * width) / long), Math.round((FIELD_LONG * height) / long));
  const short = Math.min(width, height);
  gpu.shared.uSpan.value.set(width / short, height / short);
};

const paintLook = (p) => {
  const key = JSON.stringify([p.font, p.fontSize, p.fontWeight, p.tracking, p.titleColor]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--fl-ink', p.titleColor);
  s.setProperty('--fl-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
  s.setProperty('--fl-size', String(p.fontSize));
  s.setProperty('--fl-weight', String(p.fontWeight));
  s.setProperty('--fl-tracking', p.tracking + 'em');
};

const paintTitle = (p) => {
  const key = JSON.stringify([p.title, p.lowercase]);
  if (key === cache.titleKey) {
    return cache.words;
  }
  const words = titleWords(p.title);
  headline.innerHTML = '';
  const nodes = words.map((word, i) => {
    const span = document.createElement('span');
    span.className = 'fl-word';
    span.textContent = (p.lowercase ? word.toLowerCase() : word) + (i < words.length - 1 ? ' ' : '');
    headline.appendChild(span);
    return span;
  });
  cache = { ...cache, titleKey: key, words: nodes };
  return nodes;
};

const draw = (t) => {
  const p = { ...props };
  const { width, height } = sizeOf();
  fit(width, height);
  paintLook(p);
  const words = paintTitle(p);
  const look = flowLook(p);
  const f = flowFrame(p, t, duration);

  const buffer = gpu.renderer.getDrawingBufferSize(new THREE.Vector2());
  const u = gpu.lines.uniforms;
  fitStrands(look.strands);
  gpu.shared.uRadius.value = p.size;
  gpu.field.uniforms.uOrbit.value.set(f.orbit[0], f.orbit[1]);
  gpu.field.uniforms.uFrequency.value = look.frequency;
  gpu.field.uniforms.uOctave.value = look.octave;
  u.uPixels.value.copy(buffer);
  u.uWidth.value = (WIDTH_PX * Math.min(buffer.x, buffer.y)) / REFERENCE_SHORT;
  u.uStepLength.value = (STRAND_REACH * p.size) / POINTS;
  u.uPhase.value = f.phase;
  u.uVeil.value = f.veil;
  u.uLine.value.setStyle(p.lineColor, THREE.LinearSRGBColorSpace);
  gpu.background.setStyle(p.background, THREE.LinearSRGBColorSpace);

  gpu.renderer.setRenderTarget(gpu.target);
  gpu.renderer.render(gpu.fieldScene, gpu.camera);
  gpu.renderer.setRenderTarget(null);
  gpu.renderer.setClearColor(gpu.background, 1);
  gpu.renderer.clear();
  gpu.renderer.render(gpu.linesScene, gpu.camera);

  f.words.forEach((w, i) => {
    const s = words[i].style;
    s.opacity = String(w.opacity);
    s.transform = 'translate3d(0, ' + w.y + 'em, 0)';
  });
};

draw(tl.time());
tl.to({}, { duration, ease: 'none', onUpdate: () => draw(tl.time()) }, 0);
return { still: (t) => draw(t) };
`;
