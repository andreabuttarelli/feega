import { js } from './html';

export const THREE_VERSION = '0.181.2';

export type ThreeClip = {
  id: string;
  kind: 'model' | 'shape';
  url: string | null;
  shape: string;
  color: string;
  start: number;
  length: number;
  startAngle: number;
  endAngle: number;
  orbitSpeed: number;
  zoom: number;
  lighting: string;
  shadow: boolean;
  ease: string;
};

export const LIGHTING = {
  studio: { ambient: 2.6, key: 3, fill: 1 },
  soft: { ambient: 3.4, key: 1.2, fill: 1.2 },
  dramatic: { ambient: 0.6, key: 5, fill: 0.2 }
} as const;

export function threeImportMap(): string {
  const base = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`;
  return `<script type="importmap">${js({ imports: { three: `${base}/build/three.module.js`, 'three/addons/': `${base}/examples/jsm/` } })}</script>`;
}

const SCENE_SCRIPT = `
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const DEG = Math.PI / 180;
const geometry = {
  cube: () => new THREE.BoxGeometry(1.4, 1.4, 1.4),
  sphere: () => new THREE.SphereGeometry(0.95, 64, 64),
  torus: () => new THREE.TorusGeometry(0.8, 0.32, 48, 128),
  cone: () => new THREE.ConeGeometry(0.9, 1.6, 64)
};

function stage(c) {
  const canvas = document.getElementById('three-' + c.id);
  if (!canvas) return null;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(canvas.width, canvas.height, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, canvas.width / canvas.height, 0.1, 100);
  camera.position.set(0, 0.3, 4.6 / c.zoom);
  const light = LIGHTING[c.lighting] || LIGHTING.studio;
  scene.add(new THREE.AmbientLight(0xffffff, light.ambient));
  const key = new THREE.DirectionalLight(0xffffff, light.key); key.position.set(3, 4, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, light.fill); fill.position.set(-4, 2, -3); scene.add(fill);
  if (c.shadow) {
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.05; scene.add(shadow);
  }
  const pivot = new THREE.Group();
  scene.add(pivot);
  return { renderer, scene, camera, pivot };
}

function loadModel(c, s) {
  return new Promise((resolve) => {
    if (!c.url) return resolve();
    new GLTFLoader().load(c.url, (gltf) => {
      const root = gltf.scene;
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 2 / Math.max(size.x, size.y, size.z, 1e-6);
      root.scale.setScalar(scale);
      root.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      s.pivot.add(root);
      resolve();
    }, undefined, () => resolve());
  });
}

const scenes = CLIPS.map((c) => {
  const s = stage(c);
  if (!s) return null;
  if (c.kind === 'shape') {
    s.pivot.add(new THREE.Mesh(geometry[c.shape](), new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.35, metalness: 0.1 })));
    s.pivot.rotation.set(0.35, 0, 0.1);
  }
  return { c, s, ready: c.kind === 'model' ? loadModel(c, s) : Promise.resolve() };
}).filter(Boolean);

function renderAt(time) {
  for (const { c, s } of scenes) {
    const local = Math.min(Math.max(time - c.start, 0), c.length);
    const t = window.gsap ? window.gsap.parseEase(c.ease)(c.length > 0 ? local / c.length : 1) : local / c.length;
    s.pivot.rotation.y = (c.startAngle + (c.endAngle - c.startAngle) * t + c.orbitSpeed * local) * DEG;
    s.renderer.render(s.scene, s.camera);
  }
}

window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady['motion-three'] = Promise.all(scenes.map((x) => x.ready)).then(() => renderAt(window.__hfThreeTime || 0));
window.addEventListener('hf-seek', (e) => renderAt(e.detail.time));
const tl = window.__timelines && window.__timelines.main;
if (tl) {
  tl.to({}, { duration: DURATION, onUpdate: () => renderAt(tl.time()) }, 0);
}
renderAt(window.__hfThreeTime || 0);
`;

export function threeScript(clips: ThreeClip[], duration: number): string {
  if (!clips.length) {
    return '';
  }
  return `<script type="module">const CLIPS = ${js(clips)};const LIGHTING = ${js(LIGHTING)};const DURATION = ${js(duration)};${SCENE_SCRIPT}</script>`;
}
