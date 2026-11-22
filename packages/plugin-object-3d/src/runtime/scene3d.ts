import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

export type SceneOptions = {
  shape: string;
  material: string;
  lights: string;
  autorotate: string;
  follow: string;
  color: string;
  text: string;
  model: string;
  font: string;
};

const SPIN_PER_SECOND = 0.6;
const FOLLOW_TILT = 0.6;
const FOLLOW_EASE = 0.08;
const CAMERA_DISTANCE = 4.2;
const MODEL_SIZE = 2.2;
const MAX_PIXEL_RATIO = 2;

const on = (value: string) => value === 'true';

const MATERIALS: Record<string, (color: string) => THREE.Material> = {
  glass: (color) => new THREE.MeshPhysicalMaterial({ color, transmission: 1, thickness: 1.2, roughness: 0.05, ior: 1.5, metalness: 0 }),
  metal: (color) => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.22 }),
  matte: (color) => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.9 })
};

const SHAPES: Record<string, () => THREE.BufferGeometry> = {
  cube: () => new THREE.BoxGeometry(1.6, 1.6, 1.6, 4, 4, 4),
  sphere: () => new THREE.SphereGeometry(1.1, 64, 64),
  torus: () => new THREE.TorusKnotGeometry(0.8, 0.28, 220, 32)
};

function lighting(kind: string): THREE.Light[] {
  if (kind === 'soft') {
    return [new THREE.HemisphereLight(0xffffff, 0x445566, 1.6), new THREE.AmbientLight(0xffffff, 0.6)];
  }
  if (kind === 'dramatic') {
    const spot = new THREE.SpotLight(0xffffff, 120, 0, 0.5, 0.6);
    spot.position.set(3, 4, 2);
    return [spot, new THREE.AmbientLight(0xffffff, 0.08)];
  }
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 4, 5);
  const rim = new THREE.DirectionalLight(0x88aaff, 1.2);
  rim.position.set(-4, 1, -3);
  return [key, rim, new THREE.AmbientLight(0xffffff, 0.4)];
}

function fitted(object: THREE.Object3D): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const scale = MODEL_SIZE / Math.max(size.x, size.y, size.z || 1);
  const centre = box.getCenter(new THREE.Vector3());
  const holder = new THREE.Group();
  object.position.sub(centre);
  holder.add(object);
  holder.scale.setScalar(scale);
  return holder;
}

export function mountScene(host: HTMLElement, initial: SceneOptions) {
  let options = initial;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const environment = new THREE.PMREMGenerator(renderer);
  scene.environment = environment.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, CAMERA_DISTANCE);

  const pivot = new THREE.Group();
  scene.add(pivot);
  let lights: THREE.Light[] = [];
  let built = 0;
  const pointer = { x: 0, y: 0 };
  let spin = 0;
  let frame = 0;
  let last = performance.now();

  async function content(): Promise<THREE.Object3D | null> {
    const material = (MATERIALS[options.material] ?? MATERIALS.matte)(options.color);
    if (options.shape === 'model' && options.model) {
      const gltf = await new GLTFLoader().loadAsync(options.model);
      return fitted(gltf.scene);
    }
    if (options.shape === 'text') {
      const font = await new FontLoader().loadAsync(options.font);
      const geometry = new TextGeometry(options.text || 'Feega', { font, size: 0.7, depth: 0.28, curveSegments: 10, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 4 });
      geometry.center();
      return new THREE.Mesh(geometry, material);
    }
    return new THREE.Mesh((SHAPES[options.shape] ?? SHAPES.cube)(), material);
  }

  async function build() {
    const mine = ++built;
    const object = await content().catch(() => null);
    if (mine !== built) {
      return;
    }
    pivot.clear();
    lights.forEach((light) => scene.remove(light));
    lights = lighting(options.lights);
    lights.forEach((light) => scene.add(light));
    if (object) {
      pivot.add(object);
    }
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = host;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const move = (event: PointerEvent) => {
    const box = host.getBoundingClientRect();
    pointer.x = ((event.clientX - box.left) / box.width) * 2 - 1;
    pointer.y = ((event.clientY - box.top) / box.height) * 2 - 1;
  };
  window.addEventListener('pointermove', move);

  function tick(now: number) {
    spin += on(options.autorotate) ? ((now - last) / 1000) * SPIN_PER_SECOND : 0;
    last = now;
    const tiltX = on(options.follow) ? pointer.y * FOLLOW_TILT : 0;
    const tiltY = on(options.follow) ? pointer.x * FOLLOW_TILT : 0;
    pivot.rotation.x += (tiltX - pivot.rotation.x) * FOLLOW_EASE;
    pivot.rotation.y += (spin + tiltY - pivot.rotation.y) * FOLLOW_EASE;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  }

  void build();
  frame = requestAnimationFrame(tick);

  return {
    update(next: SceneOptions) {
      const rebuild = (Object.keys(next) as (keyof SceneOptions)[]).some((key) => !['autorotate', 'follow'].includes(key) && next[key] !== options[key]);
      options = next;
      if (rebuild) {
        void build();
      }
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', move);
      renderer.dispose();
      environment.dispose();
      renderer.domElement.remove();
    }
  };
}
