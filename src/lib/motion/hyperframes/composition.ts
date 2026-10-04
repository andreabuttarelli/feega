import { instancesOf, poseAt, type PoseInput } from '../../canvas/composition/pose';
import { MEDIA_FRAGMENT_SHADER, MEDIA_UNIFORMS, MEDIA_VERTEX_SHADER } from '../../canvas/composition/shader';
import { FPS } from '../design';
import { js } from './html';
import type { PropsOf } from './templates';

export type CompositionProps = PropsOf<'Composition'>;
export type BakedMedia = { url: string; kind: CompositionProps['media'][number]['kind'] };

export type CompositionBake = {
  id: string;
  media: BakedMedia[];
  instances: number[];
  loopFrames: number;
  frames: number[];
};

export type TimedBake = CompositionBake & { start: number; length: number };

export const CAMERA_FIELDS = 7;
export const INSTANCE_FIELDS = 10;
export const COMPOSITION_READY = 'motion-composition';

const PRECISION = 10000;
const round = (n: number) => Math.round(n * PRECISION) / PRECISION;

export function resolvedMedia(p: Pick<CompositionProps, 'media'>, asset: (id: string) => string | null): BakedMedia[] {
  return p.media.flatMap((m) => {
    const url = asset(m.assetId);
    return url ? [{ url, kind: m.kind }] : [];
  });
}

export function poseInputOf(p: CompositionProps, mediaCount: number, size: { width: number; height: number }): PoseInput {
  return {
    layout: p.layout,
    layoutParams: p.layoutParams,
    camera: p.camera,
    cameraParams: p.cameraParams,
    duration: p.loop,
    mediaCount,
    aspect: size.width / size.height
  };
}

export function bakeComposition(id: string, p: CompositionProps, size: { width: number; height: number }, asset: (id: string) => string | null): CompositionBake {
  const media = resolvedMedia(p, asset);
  const input = poseInputOf(p, media.length, size);
  const instances = instancesOf(input);
  const loopFrames = Math.max(1, Math.round(p.loop * FPS));
  const frames: number[] = [];

  for (let frame = 0; frame < loopFrames; frame++) {
    const { camera, transforms } = poseAt(input, frame / FPS, instances.length);
    frames.push(camera.position.x, camera.position.y, camera.position.z, camera.target.x, camera.target.y, camera.target.z, camera.fov);
    for (const t of transforms) {
      frames.push(t.position.x, t.position.y, t.position.z, t.rotation.x, t.rotation.y, t.rotation.z, t.scale.x, t.scale.y, t.scale.z, t.opacity ?? 1);
    }
  }

  return { id, media, instances, loopFrames, frames: frames.map(round) };
}

const STAGE_SCRIPT = `
import * as THREE from 'three';

function texture(m, loads) {
  if (m.kind === 'video') {
    const video = document.createElement('video');
    video.src = m.url; video.crossOrigin = 'anonymous'; video.muted = true; video.playsInline = true; video.preload = 'auto';
    loads.push(new Promise((resolve) => { video.addEventListener('loadeddata', resolve, { once: true }); video.addEventListener('error', resolve, { once: true }); }));
    const t = new THREE.Texture(video);
    t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    return { t, video };
  }
  const t = new THREE.Texture();
  loads.push(new Promise((resolve) => {
    new THREE.ImageLoader().setCrossOrigin('anonymous').load(m.url, (image) => { t.image = image; t.needsUpdate = true; resolve(); }, undefined, resolve);
  }));
  return { t, video: null };
}

function stage(b) {
  const canvas = document.getElementById('comp-' + b.id);
  if (!canvas) return null;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, canvas.width / canvas.height, 0.1, 500);
  const loads = [];
  const sources = b.media.map((m) => texture(m, loads));
  for (const { t } of sources) { t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.premultiplyAlpha = false; }
  const meshes = b.instances.map((index) => {
    const material = new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: true,
      uniforms: { mediaTexture: { value: sources[index].t }, hasTexture: { value: 0 }, radius: { value: RADIUS }, opacity: { value: 1 } },
      vertexShader: VERTEX, fragmentShader: FRAGMENT
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    scene.add(mesh);
    return mesh;
  });
  const ready = Promise.all(loads).then(() => meshes.forEach((mesh) => { mesh.material.uniforms.hasTexture.value = 1; }));
  return { b, renderer, scene, camera, meshes, sources, ready };
}

const stages = BAKES.map(stage).filter(Boolean);

function renderAt(time) {
  for (const s of stages) {
    const local = Math.min(Math.max(time - s.b.start, 0), s.b.length);
    const stride = CAMERA_FIELDS + s.meshes.length * INSTANCE_FIELDS;
    const o = (Math.round(local * FPS) % s.b.loopFrames) * stride;
    const f = s.b.frames;
    s.camera.position.set(f[o], f[o + 1], f[o + 2]);
    s.camera.lookAt(f[o + 3], f[o + 4], f[o + 5]);
    s.camera.fov = f[o + 6];
    s.camera.updateProjectionMatrix();
    s.meshes.forEach((mesh, i) => {
      const k = o + CAMERA_FIELDS + i * INSTANCE_FIELDS;
      mesh.position.set(f[k], f[k + 1], f[k + 2]);
      mesh.rotation.set(f[k + 3], f[k + 4], f[k + 5]);
      mesh.scale.set(f[k + 6], f[k + 7], f[k + 8]);
      mesh.material.uniforms.opacity.value = f[k + 9];
    });
    for (const { t, video } of s.sources) {
      if (!video || video.readyState < 2) continue;
      video.currentTime = local % (video.duration || 1);
      t.needsUpdate = true;
    }
    s.renderer.render(s.scene, s.camera);
  }
}

window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady[READY] = Promise.all(stages.map((s) => s.ready)).then(() => renderAt(window.__hfThreeTime || 0));
window.addEventListener('hf-seek', (e) => renderAt(e.detail.time));
const tl = window.__timelines && window.__timelines.main;
if (tl) {
  tl.to({}, { duration: DURATION, onUpdate: () => renderAt(tl.time()) }, 0);
}
renderAt(window.__hfThreeTime || 0);
`;

export function compositionScript(bakes: TimedBake[], duration: number): string {
  if (!bakes.length) {
    return '';
  }
  const constants = {
    BAKES: bakes,
    DURATION: duration,
    FPS,
    CAMERA_FIELDS,
    INSTANCE_FIELDS,
    RADIUS: MEDIA_UNIFORMS.radius,
    VERTEX: MEDIA_VERTEX_SHADER,
    FRAGMENT: MEDIA_FRAGMENT_SHADER,
    READY: COMPOSITION_READY
  };
  const declarations = Object.entries(constants).map(([name, value]) => `const ${name} = ${js(value)};`).join('');
  return `<script type="module">${declarations}${STAGE_SCRIPT}</script>`;
}
