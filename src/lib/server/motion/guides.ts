import type { CustomSource } from '$lib/motion/custom/component';

export enum GuideTopic {
  ThreePerformance = '3d-performance'
}

type Guide = { uses: RegExp; text: string };

const THREE_PERFORMANCE = [
  '3D PERFORMANCE GUIDE (read once, apply to every WebGL component: THREE, twgl, PIXI)',
  'Time',
  '- Every frame comes from tl: in onUpdate read this.time() or this.progress(). Never THREE.Clock, clock.getDelta, performance.now, Date or requestAnimationFrame: export seeks frames out of order and in parallel.',
  '- Animations: mixer.setTime(t) from this.time(), never mixer.update(delta). Nothing accumulates across frames: the pose at t is computed from t alone.',
  '- Live components may loop, but stop the loop in onPause and restart it in onResume.',
  'One renderer, one canvas',
  '- const renderer = three.renderer(canvas) once, at build time. Never new THREE.WebGLRenderer, never a second renderer.',
  '- Every WebGL canvas is a context the export reads back on every frame, and an export page has 16 contexts for all its capture lanes: each extra canvas cuts the lanes and slows the export.',
  '- Many objects go in one scene, not in several components. Prefer one 3D component per scene over stacked 3D layers.',
  '- renderer.render(scene, camera) exactly once per onUpdate; no render loop, no render outside onUpdate.',
  'Size and pixel ratio',
  '- Size the canvas to the layer box: renderer.setSize(root.clientWidth, root.clientHeight, false) and camera.aspect from the same numbers.',
  '- The host sets the pixel ratio for preview, phone and export: never setPixelRatio, never read devicePixelRatio.',
  'Draw calls',
  '- More than ~20 copies of a shape: one InstancedMesh, matrices set with setMatrixAt and instanceMatrix.needsUpdate = true.',
  '- Share one geometry and one material between meshes that look alike. Static parts that never move separately: build them into one BufferGeometry.',
  '- Particles: one THREE.Points with one BufferGeometry; rewrite the position array in place and set needsUpdate, never rebuild it.',
  '- Static meshes: matrixAutoUpdate = false after placing them.',
  'Materials and light',
  '- MeshBasicMaterial, MeshLambertMaterial or MeshMatcapMaterial by default; MeshStandardMaterial or MeshPhysicalMaterial only on the hero object.',
  '- At most 3 lights: AmbientLight or HemisphereLight plus one DirectionalLight is the base.',
  '- Image-based light belongs to built-in 3D clips (set_look environment presets, 256 px HDRs). A custom component cannot load files: if it needs reflections, PMREMGenerator.fromScene once at build, never per frame.',
  '- Shadows off by default. If they matter: one casting light, shadow.mapSize at most 1024, a tight shadow camera, castShadow only on the subject.',
  'Textures',
  '- At most 2048 px, power of two; pictures from asset props, procedural ones from a CanvasTexture built once.',
  '- colorSpace = THREE.SRGBColorSpace on colour maps; needsUpdate only when the texture actually changed.',
  'Shaders and allocation',
  '- After building the scene call renderer.compile(scene, camera), so the first sought frame does not stall on shader compilation.',
  '- No new Vector3, Matrix4, Color, geometry or material inside onUpdate: create them once and reuse them.',
  '- twgl: createProgramInfo and buffers once, setUniforms({ t: this.time() }) per frame; mediump precision unless the shader needs highp.',
  '- No post-processing chains: at most one extra render target, at half size.',
  'Cleanup',
  '- onDestroy(() => { geometry.dispose(); material.dispose(); texture.dispose(); renderer.dispose(); }) for everything you created.'
].join('\n');

export const GUIDES: Record<GuideTopic, Guide> = {
  [GuideTopic.ThreePerformance]: { uses: /\bTHREE\b|\bthree\.renderer\b|\btwgl\b|\bPIXI\b/, text: THREE_PERFORMANCE }
};

export function guidesFor(source: CustomSource, given: readonly GuideTopic[]): GuideTopic[] {
  return Object.values(GuideTopic).filter((topic) => !given.includes(topic) && GUIDES[topic].uses.test(source.js));
}
