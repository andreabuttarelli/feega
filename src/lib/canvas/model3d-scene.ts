import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { renderViewPositions } from './model3d-views';

export type Model3dScene = {
  setAutoRotate(on: boolean): void;
  renderViews(): Promise<Blob[]>;
  dispose(): void;
};

const FOV_DEG = 35;
const FIT_MARGIN = 1.35;
const CAMERA_LIFT = 0.25;
const MAX_PIXEL_RATIO = 2;
const AUTO_ROTATE_SPEED = 2;
const SNAPSHOT_SIZE = 1024;
const SNAPSHOT_MIME = 'image/png';
const BACKGROUND = 0xf4f4f2;

function fitDistance(radius: number): number {
  return (radius * FIT_MARGIN) / Math.sin(THREE.MathUtils.degToRad(FOV_DEG / 2));
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('snapshot_failed'))), SNAPSHOT_MIME));
}

export async function mountModel3d(container: HTMLElement, url: string): Promise<Model3dScene> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(BACKGROUND);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.01, 1000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = AUTO_ROTATE_SPEED;

  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
  model.position.sub(sphere.center);
  scene.add(model);

  const distance = fitDistance(sphere.radius);
  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.position.set(0, sphere.radius * CAMERA_LIFT, distance);
  camera.updateProjectionMatrix();

  function resize(): void {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) {
      return;
    }
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  function draw(): void {
    controls.update();
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(draw);

  async function renderViews(): Promise<Blob[]> {
    const size = renderer.getSize(new THREE.Vector2());
    const lens = new THREE.PerspectiveCamera(FOV_DEG, 1, camera.near, camera.far);
    renderer.setAnimationLoop(null);
    renderer.setSize(SNAPSHOT_SIZE, SNAPSHOT_SIZE, false);
    try {
      const blobs: Blob[] = [];
      for (const position of renderViewPositions(distance, sphere.radius * CAMERA_LIFT)) {
        lens.position.set(position.x, position.y, position.z);
        lens.lookAt(0, 0, 0);
        renderer.render(scene, lens);
        blobs.push(await canvasBlob(renderer.domElement));
      }
      return blobs;
    } finally {
      renderer.setSize(size.x, size.y, false);
      renderer.setAnimationLoop(draw);
    }
  }

  return {
    setAutoRotate: (on) => {
      controls.autoRotate = on;
    },
    renderViews,
    dispose: () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
