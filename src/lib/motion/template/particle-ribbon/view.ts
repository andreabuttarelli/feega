import { RIBBON_FRAGMENT, RIBBON_VERTEX } from './shader';

export const RIBBON_VIEW = String.raw`
const VERTEX = ${JSON.stringify(RIBBON_VERTEX)};
const FRAGMENT = ${JSON.stringify(RIBBON_FRAGMENT)};
const FOV = 30;
const SPAN = { width: 2.5, height: 2.8 };
const SIZE_AT_1080 = 3;

root.insertAdjacentHTML('beforeend', '<div class="pr"><canvas class="pr-canvas"></canvas><i class="pr-veil"></i><div class="pr-title"><h1 class="pr-headline"></h1></div></div>');

const scene = root.querySelector('.pr');
const canvas = root.querySelector('.pr-canvas');
const veil = root.querySelector('.pr-veil');
const headline = root.querySelector('.pr-headline');

const renderer = three.renderer(canvas, { antialias: false });
const world = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
const geometry = new THREE.BufferGeometry();
const seeds = particleSeeds(MAX_PARTICLES);
geometry.setAttribute('position', new THREE.BufferAttribute(seeds, 3));
geometry.setAttribute('seed', new THREE.BufferAttribute(particleSeeds(MAX_PARTICLES).reverse(), 3));
geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);

const uniforms = {
  uPhase: { value: 0 },
  uFold: { value: 0 },
  uSway: { value: 0 },
  uTwist: { value: 2.4 },
  uDust: { value: 1 },
  uSize: { value: 1 },
  uStops: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) }
};
const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms, transparent: true, depthWrite: false, depthTest: false });
const points = new THREE.Points(geometry, material);
points.frustumCulled = false;
world.add(points);

let cache = { lookKey: '', titleKey: '', words: [], sizeKey: '' };

const fit = (width, height) => {
  const key = width + 'x' + height;
  if (key === cache.sizeKey) {
    return;
  }
  cache = { ...cache, sizeKey: key };
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
};

const distanceFor = (aspect) => {
  const half = Math.tan((FOV * Math.PI) / 360);
  return Math.max(SPAN.height / 2 / half, SPAN.width / 2 / (half * aspect));
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.titleColor, p.font, p.fontSize, p.fontWeight, p.tracking]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const s = scene.style;
  s.setProperty('--pr-bg', p.background);
  s.setProperty('--pr-ink', p.titleColor);
  s.setProperty('--pr-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
  s.setProperty('--pr-size', String(p.fontSize));
  s.setProperty('--pr-weight', String(p.fontWeight));
  s.setProperty('--pr-tracking', p.tracking + 'em');
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
    node.className = 'pr-word';
    node.textContent = (p.lowercase ? word.toLowerCase() : word) + (i < words.length - 1 ? ' ' : '');
    headline.appendChild(node);
    return node;
  });
  cache = { ...cache, titleKey: key, words: nodes };
  return nodes;
};

const draw = (t) => {
  const p = { ...props };
  const width = scene.clientWidth || 1080;
  const height = scene.clientHeight || 1920;
  fit(width, height);
  paintLook(p);
  const words = paintTitle(p);
  const f = ribbonFrame(p, t, duration);

  const distance = distanceFor(width / height);
  camera.position.set(distance * Math.sin(f.yaw), distance * Math.sin(f.pitch), distance * Math.cos(f.yaw));
  camera.lookAt(0, 0, 0);
  points.rotation.z = -0.12 + 0.08 * Math.sin(f.phase);

  uniforms.uPhase.value = f.phase;
  uniforms.uFold.value = f.fold;
  uniforms.uSway.value = f.sway;
  uniforms.uTwist.value = p.twist;
  uniforms.uDust.value = p.dust;
  uniforms.uSize.value = p.grainSize * SIZE_AT_1080 * (Math.min(width, height) / 1080) * renderer.getPixelRatio();
  gradientStops(p).forEach((c, i) => uniforms.uStops.value[i].set(c[0], c[1], c[2]));
  geometry.setDrawRange(0, particleCount(p.density));
  renderer.render(world, camera);

  veil.style.opacity = String(f.veil);
  f.words.forEach((w, i) => {
    const s = words[i].style;
    s.opacity = String(w.opacity);
    s.transform = 'translate3d(0, ' + w.y + 'em, 0)';
  });
};

onDestroy(() => {
  geometry.dispose();
  material.dispose();
  renderer.dispose();
});

draw(0);
tl.to({}, { duration, ease: 'none', onUpdate: () => draw(tl.time()) }, 0);
return { still: draw };
`;
