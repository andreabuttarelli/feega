export const BLOBS_VIEW = String.raw`
root.insertAdjacentHTML('beforeend', '<div class="ib"><canvas class="ib-canvas"></canvas><div class="ib-title"><h1 class="ib-headline"></h1></div></div>');

const scene = root.querySelector('.ib');
const canvas = root.querySelector('.ib-canvas');
const headline = root.querySelector('.ib-headline');

const renderer = three.renderer(canvas);
const stage = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const vec3s = (n) => Array.from({ length: n }, () => new THREE.Vector3());
const uniforms = {
  uRes: { value: new THREE.Vector2(1, 1) },
  uPortrait: { value: 1 },
  uBlobs: { value: vec3s(MAX_BLOB_UNIFORMS) },
  uBubbles: { value: vec3s(MAX_BUBBLE_UNIFORMS) },
  uBubbleCount: { value: 0 },
  uPhase: { value: 0 },
  uSeed: { value: 0 },
  uGlitter: { value: 0 },
  uDim: { value: 0 },
  uBg: { value: new THREE.Vector3() },
  uBody: { value: new THREE.Vector3() },
  uSheen: { value: new THREE.Vector3() },
  uRim: { value: new THREE.Vector3() },
  uGlow: { value: new THREE.Vector3() }
};
const geometry = new THREE.PlaneGeometry(2, 2);
const material = new THREE.ShaderMaterial({ vertexShader: BLOBS_VERTEX, fragmentShader: BLOBS_FRAGMENT, uniforms, depthTest: false, depthWrite: false });
stage.add(new THREE.Mesh(geometry, material));
const buffer = new THREE.Vector2();

onDestroy(() => {
  geometry.dispose();
  material.dispose();
  renderer.dispose();
});

let cache = { layoutKey: '', layout: null, sizeKey: '', lookKey: '', titleKey: '', words: [] };

const sizeOf = () => ({ width: scene.clientWidth || 1080, height: scene.clientHeight || 1920 });

const layoutFor = (p) => {
  const key = JSON.stringify([p.seed]);
  if (key !== cache.layoutKey) {
    cache = { ...cache, layoutKey: key, layout: blobsLayout(p) };
  }
  return cache.layout;
};

const fit = (width, height) => {
  const key = width + 'x' + height;
  if (key === cache.sizeKey) {
    return;
  }
  cache = { ...cache, sizeKey: key };
  renderer.setSize(width, height, false);
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.body, p.sheen, p.rim, p.glow, p.titleColor, p.font, p.fontSize, p.fontWeight, p.tracking]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  [['uBg', p.background], ['uBody', p.body], ['uSheen', p.sheen], ['uRim', p.rim], ['uGlow', p.glow]].forEach(([name, hex]) => uniforms[name].value.fromArray(hexRgb(hex)));
  const s = scene.style;
  s.setProperty('--ib-bg', p.background);
  s.setProperty('--ib-ink', p.titleColor);
  s.setProperty('--ib-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
  s.setProperty('--ib-size', String(p.fontSize));
  s.setProperty('--ib-weight', String(p.fontWeight));
  s.setProperty('--ib-tracking', p.tracking + 'em');
};

const paintTitle = (p) => {
  const key = JSON.stringify([p.title, p.lowercase]);
  if (key === cache.titleKey) {
    return cache.words;
  }
  const words = titleWords(p.title);
  headline.innerHTML = '';
  const nodes = words.map((word, i) => {
    const node = document.createElement('span');
    node.className = 'ib-word';
    node.textContent = (p.lowercase ? word.toLowerCase() : word) + (i < words.length - 1 ? ' ' : '');
    headline.appendChild(node);
    return node;
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
  const f = blobsFrame(layoutFor(p), p, t, duration);

  renderer.getDrawingBufferSize(buffer);
  uniforms.uRes.value.copy(buffer);
  uniforms.uPortrait.value = height >= width ? 1 : 0;
  f.blobs.forEach((b, i) => uniforms.uBlobs.value[i].set(b.x, b.y, b.r));
  f.bubbles.forEach((b, i) => uniforms.uBubbles.value[i].set(b.x, b.y, b.r));
  uniforms.uBubbleCount.value = f.bubbles.length;
  uniforms.uPhase.value = f.phase;
  uniforms.uSeed.value = (Math.round(p.seed) % 17) * 0.37;
  uniforms.uGlitter.value = p.glitter;
  uniforms.uDim.value = f.dim;
  renderer.render(stage, camera);

  f.words.forEach((w, i) => {
    const s = words[i].style;
    s.opacity = String(w.opacity);
    s.transform = 'translate3d(0, ' + w.y + 'em, 0)';
  });
};

draw(0);
tl.to({}, { duration, ease: 'none', onUpdate: () => draw(tl.time()) }, 0);

return { still: (t) => draw(t) };
`;
