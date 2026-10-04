import { js } from './html';
import { SCENE, sampleTrack, type Keyframe, type SceneKey } from '../keyframes';
import type { StageSpec } from '../camera';
import { cameraRuntime, seekDriver } from './stage';

export const THREE_VERSION = '0.181.2';
export const THREE_TIMELINE = 'feegaThree';

export function onScreen(clip: { start: number; length: number }, time: number): boolean {
  return time >= clip.start && time <= clip.start + clip.length;
}

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
  fps: number;
  keys: Partial<Record<SceneKey, Keyframe[]>>;
  depth: number | null;
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

const BOKEH_TAPS = 24;
const PROBES = 8;
const BOKEH_VERTEX = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
const BOKEH_FRAGMENT = [
  '#include <packing>',
  'uniform sampler2D tColor;uniform sampler2D tDepth;uniform float near;uniform float far;uniform vec2 size;',
  'uniform float focus;uniform float aperture;uniform float pxPerUnit;uniform float rest;uniform float clipDepth;uniform float maxBlur;',
  'varying vec2 vUv;',
  'float blurOf(float depthPx){return min(maxBlur,aperture*abs(depthPx-focus)/100.0);}',
  'void main(){',
  '  float d=texture2D(tDepth,vUv).x;',
  '  float coc=d>=1.0?blurOf(clipDepth):blurOf(clipDepth+(-perspectiveDepthToViewZ(d,near,far)-rest)*pxPerUnit);',
  '  vec4 sum=vec4(0.0);',
  '  if(coc<0.5){vec4 c=texture2D(tColor,vUv);sum=vec4(c.rgb*c.a,c.a);}',
  '  else{',
  '    float cover=0.0;',
  '    for(int i=0;i<' + PROBES + ';i++){float a=float(i)*6.28318/' + PROBES + '.0;vec2 o=vec2(cos(a),sin(a))*coc/size;cover+=texture2D(tColor,vUv+o).a+texture2D(tColor,vUv+o*0.5).a;}',
  '    if(d<1.0||cover>0.0){',
  '      for(int i=0;i<' + BOKEH_TAPS + ';i++){',
  '        float a=float(i)*2.39996;float r=sqrt((float(i)+0.5)/' + BOKEH_TAPS + '.0)*coc;',
  '        vec4 c=texture2D(tColor,vUv+vec2(cos(a),sin(a))*r/size);',
  '        sum+=vec4(c.rgb*c.a,c.a);',
  '      }',
  '      sum/=' + BOKEH_TAPS + '.0;',
  '    }',
  '  }',
  '  gl_FragColor=vec4(sum.a>0.0?sum.rgb/sum.a:vec3(0.0),sum.a);',
  '  #include <colorspace_fragment>',
  '  gl_FragColor.rgb*=gl_FragColor.a;',
  '}'
].join(String.fromCharCode(10));

function bokeh(canvas) {
  const depthTexture = new THREE.DepthTexture(canvas.width, canvas.height);
  const target = new THREE.WebGLRenderTarget(canvas.width, canvas.height, { depthTexture });
  const material = new THREE.ShaderMaterial({
    uniforms: { tColor: { value: target.texture }, tDepth: { value: depthTexture }, near: { value: 0.1 }, far: { value: 100 }, size: { value: new THREE.Vector2(canvas.width, canvas.height) }, focus: { value: 0 }, aperture: { value: 0 }, pxPerUnit: { value: 1 }, rest: { value: 1 }, clipDepth: { value: 0 }, maxBlur: { value: CAMERA_MATH.MAX_BLUR } },
    vertexShader: BOKEH_VERTEX,
    fragmentShader: BOKEH_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  return { target, material, scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
}

function stage(c) {
  const canvas = document.getElementById('three-' + c.id);
  if (!canvas) return null;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(canvas.width, canvas.height, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, canvas.width / canvas.height, 0.1, 100);
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
  const object = new THREE.Group();
  pivot.add(object);
  scene.add(pivot);
  return { renderer, scene, camera, pivot, object, bokeh: STAGE && STAGE.dof && c.depth !== null ? bokeh(canvas) : null };
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
      s.object.add(root);
      resolve();
    }, undefined, () => resolve());
  });
}

const scenes = CLIPS.map((c) => {
  const s = stage(c);
  if (!s) return null;
  if (c.kind === 'shape') {
    s.object.add(new THREE.Mesh(geometry[c.shape](), new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.35, metalness: 0.1 })));
    s.pivot.rotation.set(0.35, 0, 0.1);
  }
  return { c, s, ready: c.kind === 'model' ? loadModel(c, s) : Promise.resolve() };
}).filter(Boolean);

function legacyOrbit(c, local) {
  const t = window.gsap ? window.gsap.parseEase(c.ease)(c.length > 0 ? local / c.length : 1) : local / c.length;
  return c.startAngle + (c.endAngle - c.startAngle) * t + c.orbitSpeed * local;
}

function renderAt(time) {
  for (const { c, s } of scenes) {
    if (!onScreen(c, time)) continue;
    const local = Math.min(Math.max(time - c.start, 0), c.length);
    const at = (key, fallback) => (c.keys[key] ? sampleTrack(c.keys[key], local * c.fps) : fallback);
    s.pivot.rotation.y = at('orbit', legacyOrbit(c, local)) * DEG;
    s.object.rotation.set(at('objectRotateX', 0) * DEG, at('objectRotateY', 0) * DEG, at('objectRotateZ', 0) * DEG);
    const distance = 4.6 / at('dolly', c.zoom);
    s.camera.position.set(0, 0.3, distance);
    s.camera.fov = at('fov', FOV);
    if (STAGE && c.depth !== null) {
      const v = CAMERA_MATH.valuesAt(STAGE, time * c.fps);
      const view = CAMERA_MATH.orbitView(v, STAGE, c.depth);
      s.camera.position.set(view.direction[0] * distance, 0.3 + view.direction[1] * distance, view.direction[2] * distance);
      s.camera.up.set(view.up[0], view.up[1], view.up[2]);
      s.camera.lookAt(0, 0.3, 0);
      if (s.bokeh) {
        const u = s.bokeh.material.uniforms;
        u.focus.value = v.focusDistance;
        u.aperture.value = v.aperture;
        u.rest.value = distance;
        u.pxPerUnit.value = (STAGE.rest + c.depth) / distance;
        u.clipDepth.value = c.depth;
      }
    }
    s.camera.updateProjectionMatrix();
    if (!s.bokeh) {
      s.renderer.render(s.scene, s.camera);
      continue;
    }
    s.renderer.setRenderTarget(s.bokeh.target);
    s.renderer.clear();
    s.renderer.render(s.scene, s.camera);
    s.renderer.setRenderTarget(null);
    s.renderer.clear();
    s.renderer.render(s.bokeh.scene, s.bokeh.camera);
  }
}

window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady['motion-three'] = Promise.all(scenes.map((x) => x.ready)).then(() => renderAt(window.__hfThreeTime || 0));
window.addEventListener('hf-seek', (e) => renderAt(e.detail.time));
const tl = window.__timelines && window.__timelines.main;
const gsap = window.gsap;
DRIVER
renderAt(window.__hfThreeTime || 0);
`;

export function threeScript(clips: ThreeClip[], duration: number, stage: StageSpec | null): string {
  if (!clips.length) {
    return '';
  }
  return `<script type="module">const CLIPS = ${js(clips)};const LIGHTING = ${js(LIGHTING)};const DURATION = ${js(duration)};const FOV = ${SCENE.fov.fallback};const STAGE = ${js(stage)};${cameraRuntime()}const sampleTrack = (${sampleTrack.toString()});const onScreen = (${onScreen.toString()});${SCENE_SCRIPT.replace('DRIVER', seekDriver(THREE_TIMELINE, 'DURATION', 'renderAt'))}</script>`;
}
