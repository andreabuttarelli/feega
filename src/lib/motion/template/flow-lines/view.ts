import { FIELD_FRAGMENT, LINES_FRAGMENT, QUAD_VERTEX } from './shaders';

export const FLOW_VIEW = String.raw`
const QUAD_VERTEX = ${JSON.stringify(QUAD_VERTEX)};
const FIELD_FRAGMENT = ${JSON.stringify(FIELD_FRAGMENT)};
const LINES_FRAGMENT = ${JSON.stringify(LINES_FRAGMENT)};
const FIELD_LONG = 640;
const NOISE_SIZE = 512;
const NOISE_SEED = 0x9e3779b9;
const REFERENCE_SHORT = 1080;
const STEP_PX = 2.2;
const GAIN = 1.1;

root.insertAdjacentHTML('beforeend', '<div class="fl"><canvas class="fl-canvas"></canvas><div class="fl-title"><h1 class="fl-headline"></h1></div></div>');

const scene = root.querySelector('.fl');
const canvas = root.querySelector('.fl-canvas');
const headline = root.querySelector('.fl-headline');

let cache = { lookKey: '', titleKey: '', words: [], sizeKey: '' };

const sizeOf = () => ({ width: scene.clientWidth || 1080, height: scene.clientHeight || 1920 });

const hashNoise = () => {
  const bytes = new Uint8Array(NOISE_SIZE * NOISE_SIZE * 4);
  let s = NOISE_SEED;
  for (let i = 0; i < bytes.length; i += 4) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    bytes[i] = s & 255;
    bytes[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(bytes, NOISE_SIZE, NOISE_SIZE, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
};

const gpu = (() => {
  const renderer = three.renderer(canvas);
  renderer.autoClear = false;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.PlaneGeometry(2, 2);
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const shared = { uSpan: { value: new THREE.Vector2(1, 1) }, uRadius: { value: 0.4 } };
  const field = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERTEX,
    fragmentShader: FIELD_FRAGMENT,
    uniforms: { ...shared, uOrbit: { value: new THREE.Vector2(1, 0) }, uFrequency: { value: 1 }, uOctave: { value: 0 } }
  });
  const lines = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERTEX,
    fragmentShader: LINES_FRAGMENT,
    uniforms: {
      ...shared,
      uField: { value: target.texture },
      uNoise: { value: hashNoise() },
      uPixels: { value: new THREE.Vector2(1, 1) },
      uNoiseSize: { value: NOISE_SIZE },
      uStep: { value: STEP_PX },
      uPhase: { value: 0 },
      uSparsity: { value: 8 },
      uVeil: { value: 0 },
      uGain: { value: GAIN },
      uLine: { value: new THREE.Color(1, 1, 1) },
      uBackground: { value: new THREE.Color(0, 0, 0) }
    }
  });
  const fieldScene = new THREE.Scene();
  fieldScene.add(new THREE.Mesh(quad, field));
  const linesScene = new THREE.Scene();
  linesScene.add(new THREE.Mesh(quad, lines));
  return { renderer, camera, target, field, lines, fieldScene, linesScene, shared };
})();

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
  gpu.shared.uRadius.value = p.size;
  gpu.field.uniforms.uOrbit.value.set(f.orbit[0], f.orbit[1]);
  gpu.field.uniforms.uFrequency.value = look.frequency;
  gpu.field.uniforms.uOctave.value = look.octave;
  u.uPixels.value.copy(buffer);
  u.uStep.value = (STEP_PX * Math.min(buffer.x, buffer.y)) / REFERENCE_SHORT;
  u.uPhase.value = f.phase;
  u.uSparsity.value = look.sparsity;
  u.uVeil.value = f.veil;
  u.uLine.value.setStyle(p.lineColor, THREE.LinearSRGBColorSpace);
  u.uBackground.value.setStyle(p.background, THREE.LinearSRGBColorSpace);

  gpu.renderer.setRenderTarget(gpu.target);
  gpu.renderer.render(gpu.fieldScene, gpu.camera);
  gpu.renderer.setRenderTarget(null);
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
