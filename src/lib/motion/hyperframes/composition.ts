import { LOOK_FIELDS, SOLID_LOOK, cardBox, lookOf, type CardLook } from '../../canvas/composition/card-look';
import { layoutOf } from '../../canvas/composition/index';
import { instancesOf, poseAt, type PoseInput } from '../../canvas/composition/pose';
import { MEDIA_FRAGMENT_SHADER, MEDIA_UNIFORMS, MEDIA_VERTEX_SHADER } from '../../canvas/composition/shader';
import { js } from './html';
import type { PropsOf } from './templates';
import { GPU_GLOBAL } from './gpu';
import { ON_DISPOSE, hotScope, hotSeek, keptGl } from './hot';

export type CompositionProps = PropsOf<'Composition'>;
export type BakedMedia = { url: string; kind: CompositionProps['media'][number]['kind'] };

export type CompositionBake = {
  id: string;
  media: BakedMedia[];
  instances: number[];
  loopFrames: number;
  fps: number;
  frames: number[];
  looks: number[];
};

export type TimedBake = CompositionBake & { start: number; length: number };

export const CAMERA_FIELDS = 7;
export const INSTANCE_FIELDS = 10;
export { LOOK_FIELDS };
export const COMPOSITION_READY = 'motion-composition';

const PRECISION = 10000;
const VIDEO_READY_TIMEOUT_MS = 8000;

export function compositionVideoId(clipId: string, mediaIndex: number): string {
  return `cv-${clipId}-${mediaIndex}`;
}

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
    layoutSpec: p.layoutSpec,
    layoutParams: p.layoutParams,
    camera: p.camera,
    cameraParams: p.cameraParams,
    duration: p.loop,
    mediaCount,
    aspect: size.width / size.height
  };
}

export function bakeComposition(id: string, p: CompositionProps, size: { width: number; height: number; fps: number }, asset: (id: string) => string | null): CompositionBake {
  const media = resolvedMedia(p, asset);
  const input = poseInputOf(p, media.length, size);
  const instances = instancesOf(input);
  const loopFrames = Math.max(1, Math.round(p.loop * size.fps));
  const frames: number[] = [];

  for (let frame = 0; frame < loopFrames; frame++) {
    const { camera, transforms } = poseAt(input, frame / size.fps, instances.length);
    frames.push(camera.position.x, camera.position.y, camera.position.z, camera.target.x, camera.target.y, camera.target.z, camera.fov);
    for (const t of transforms) {
      frames.push(t.position.x, t.position.y, t.position.z, t.rotation.x, t.rotation.y, t.rotation.z, t.scale.x, t.scale.y, t.scale.z, t.opacity ?? 1);
    }
  }

  const cards = p.media.filter((m) => asset(m.assetId));
  const layout = layoutOf(p.layout, p.layoutSpec);
  const defaults = Object.fromEntries(layout.params.map((param) => [param.name, param.default]));
  const params = { ...defaults, ...p.layoutParams };
  const marks = layout.solids?.(instances.length, input.layoutParams) ?? 0;
  const looks = instances.flatMap((mediaIndex, i): number[] => {
    const look: CardLook = i >= instances.length - marks ? SOLID_LOOK : lookOf(cards[mediaIndex] ?? {}, params);
    return [look.aspect, look.fit, look.focusX, look.focusY, look.solid];
  });

  return { id, media, instances, loopFrames, fps: size.fps, frames: frames.map(round), looks: looks.map(round) };
}

const STAGE_SCRIPT = `
import * as THREE from 'three';
${hotScope(COMPOSITION_READY)}
${keptGl()}
let live = true;

function texture(b, m, i, loads) {
  if (m.kind === 'video') {
    const id = 'cv-' + b.id + '-' + i;
    const video = document.getElementById(id);
    if (video && video.readyState < 2) {
      loads.push(new Promise((resolve) => { video.addEventListener('loadeddata', resolve, { once: true }); video.addEventListener('error', resolve, { once: true }); setTimeout(resolve, VIDEO_READY_MS); }));
    }
    const t = new THREE.Texture();
    t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    const source = { t, video, frameId: '__render_frame_' + id + '__', aspect: 1 };
    if (video) {
      const measure = () => { source.aspect = video.videoWidth / video.videoHeight || 1; };
      if (video.readyState >= 1) measure(); else video.addEventListener('loadedmetadata', measure, { once: true });
    }
    return source;
  }
  const t = new THREE.Texture();
  loads.push(new Promise((resolve) => {
    new THREE.ImageLoader().setCrossOrigin('anonymous').load(m.url, (image) => { t.image = image; t.needsUpdate = true; source.aspect = image.naturalWidth / image.naturalHeight || 1; resolve(); }, undefined, resolve);
  }));
  const source = { t, video: null, aspect: 1 };
  return source;
}

function stage(b) {
  const renderer = keptRenderer('comp-' + b.id, (canvas) => window.${GPU_GLOBAL}.renderer(THREE, canvas));
  if (!renderer) return null;
  const canvas = renderer.domElement;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, canvas.width / canvas.height, 0.1, 500);
  const loads = [];
  const sources = b.media.map((m, i) => texture(b, m, i, loads));
  for (const { t } of sources) { t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.premultiplyAlpha = false; }
  const meshes = b.instances.map((index, i) => {
    const look = b.looks.slice(i * LOOK_FIELDS, (i + 1) * LOOK_FIELDS);
    const material = new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: true,
      uniforms: { mediaTexture: { value: sources[index].t }, hasTexture: { value: 0 }, radius: { value: RADIUS }, opacity: { value: 1 }, cardAspect: { value: 1 }, mediaAspect: { value: 1 }, fit: { value: look[1] }, focus: { value: new THREE.Vector2(look[2], look[3]) }, solid: { value: look[4] } },
      vertexShader: VERTEX, fragmentShader: FRAGMENT
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.userData = { aspect: look[0], source: sources[index], box: [1, 1] };
    scene.add(mesh);
    return mesh;
  });
  const shape = () => meshes.forEach((mesh) => {
    const media = mesh.userData.source.aspect;
    const aspect = mesh.userData.aspect > 0 ? mesh.userData.aspect : media;
    mesh.material.uniforms.mediaAspect.value = media;
    mesh.material.uniforms.cardAspect.value = mesh.material.uniforms.solid.value > 0.5 ? 1 : aspect;
    mesh.userData.box = mesh.material.uniforms.solid.value > 0.5 ? [1, 1] : cardBox(aspect);
  });
  shape();
  const ready = Promise.all(loads).then(() => { shape(); meshes.forEach((mesh) => { mesh.material.uniforms.hasTexture.value = 1; }); });
  return { b, renderer, scene, camera, meshes, sources, ready };
}

const stages = BAKES.map(stage).filter(Boolean);
dropUnused('comp-', BAKES.map((b) => 'comp-' + b.id));
const STALE = '__feegaStaleComposition';
const replaced = window[STALE] || [];
window[STALE] = [];
${ON_DISPOSE}(() => {
  live = false;
  window[STALE].push(() => stages.forEach((s) => disposeScene(s.scene)));
});

function renderAt(time) {
  if (!live) return;
  for (const s of stages) {
    const local = Math.min(Math.max(time - s.b.start, 0), s.b.length);
    const stride = CAMERA_FIELDS + s.meshes.length * INSTANCE_FIELDS;
    const o = (Math.round(local * s.b.fps) % s.b.loopFrames) * stride;
    const f = s.b.frames;
    s.camera.position.set(f[o], f[o + 1], f[o + 2]);
    s.camera.lookAt(f[o + 3], f[o + 4], f[o + 5]);
    s.camera.fov = f[o + 6];
    s.camera.updateProjectionMatrix();
    s.meshes.forEach((mesh, i) => {
      const k = o + CAMERA_FIELDS + i * INSTANCE_FIELDS;
      mesh.position.set(f[k], f[k + 1], f[k + 2]);
      mesh.rotation.set(f[k + 3], f[k + 4], f[k + 5]);
      mesh.scale.set(f[k + 6] * mesh.userData.box[0], f[k + 7] * mesh.userData.box[1], f[k + 8]);
      mesh.material.uniforms.opacity.value = f[k + 9];
    });
    for (const { t, video, frameId } of s.sources) {
      if (!video) continue;
      const injected = document.getElementById(frameId);
      const frame = injected && injected.complete && injected.naturalWidth ? injected : video.readyState >= 2 ? video : null;
      if (!frame) continue;
      t.image = frame;
      t.needsUpdate = true;
    }
    s.renderer.render(s.scene, s.camera);
  }
}

window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady[READY] = Promise.all(stages.map((s) => s.ready)).then(() => {
  renderAt(window.__hfThreeTime || 0);
  replaced.forEach((dispose) => dispose());
});
${hotSeek('renderAt')}
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
    CAMERA_FIELDS,
    INSTANCE_FIELDS,
    LOOK_FIELDS,
    RADIUS: MEDIA_UNIFORMS.radius,
    VERTEX: MEDIA_VERTEX_SHADER,
    FRAGMENT: MEDIA_FRAGMENT_SHADER,
    READY: COMPOSITION_READY,
    VIDEO_READY_MS: VIDEO_READY_TIMEOUT_MS
  };
  const declarations = Object.entries(constants).map(([name, value]) => `const ${name} = ${js(value)};`).join('');
  return `<script type="module">${declarations}${cardBox.toString()}${STAGE_SCRIPT}</script>`;
}
