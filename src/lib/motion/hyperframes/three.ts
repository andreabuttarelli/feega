import { js } from './html';
import { SCENE, sampleTrack, type Keyframe, type SceneKey } from '../keyframes';
import type { StageSpec } from '../camera';
import { hdriUrl, type Look } from '../look';
import { SURFACE, type Material, type Surface } from '../materials';
import { cameraRuntime, seekDriver } from './stage';
import { DEVICE_SCRIPT, type DeviceRuntime } from './device-runtime';
import { ENGINE_GLOBAL } from '../engine/engine';
import { drawOnce, screenKey } from './three-draw';
import { ON_DISPOSE, hotScope, hotSeek, keptGl } from './hot';

export const THREE_VERSION = '0.181.2';
export const THREE_TIMELINE = 'feegaThree';
export const THREE_REDRAW = '__feegaThreeRedraw';
export const OPENTYPE_URL = 'https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/dist/opentype.module.js';

export function onScreen(clip: { start: number; length: number }, time: number): boolean {
  return time >= clip.start && time <= clip.start + clip.length;
}

export enum ThreeKind {
  Model = 'model',
  Shape = 'shape',
  Text = 'text',
  Logo = 'logo',
  Device = 'device'
}

export type ThreeClip = {
  id: string;
  kind: ThreeKind;
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
  surface: Surface | null;
  text: string;
  extrude: number;
  bevel: number;
  device: DeviceRuntime | null;
  video: boolean;
};

export const LIGHTING = {
  studio: { ambient: 2.6, key: 3, fill: 1 },
  soft: { ambient: 3.4, key: 1.2, fill: 1.2 },
  dramatic: { ambient: 0.6, key: 5, fill: 0.2 }
} as const;

export type LookRuntime = Look & { hdri: string | null };

export function lookRuntime(look: Look | null): LookRuntime | null {
  return look ? { ...look, hdri: hdriUrl(look.environment.preset) } : null;
}

export function surfaceOf(material: Material | undefined): Surface | null {
  return material ? SURFACE[material] : null;
}

export function threeAssetUrls(look: LookRuntime | null, clips: readonly ThreeClip[]): string[] {
  const outlines = clips.filter((c) => c.kind === ThreeKind.Text && c.url).map((c) => c.url!);
  return [...(look?.hdri ? [look.hdri] : []), ...outlines];
}

export function threeImportMap(): string {
  const base = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`;
  return `<script type="importmap">${js({ imports: { three: `${base}/build/three.module.js`, 'three/addons/': `${base}/examples/jsm/`, opentype: OPENTYPE_URL } })}</script>`;
}

const SCENE_SCRIPT = `
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
${hotScope(THREE_TIMELINE)}
${keptGl()}
const FONT_CACHE = '__feegaFontFiles';
let live = true;

const DEG = Math.PI / 180;
const FLOOR = -1.05;
const FIT = 2;
const SHADOW_MAP = 512;
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

const LIGHT_BUILD = {
  directional: (l) => new THREE.DirectionalLight(l.color, l.intensity),
  point: (l) => new THREE.PointLight(l.color, l.intensity, 0, 2),
  spot: (l) => new THREE.SpotLight(l.color, l.intensity, 0, Math.PI / 4, 0.7, 2),
  area: (l) => new THREE.RectAreaLight(l.color, l.intensity, 4, 4)
};

const CASTS = { directional: true, point: true, spot: true, area: false };

function castShadow(light) {
  light.castShadow = true;
  light.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  light.shadow.bias = -0.003;
  light.shadow.normalBias = 0.04;
  if (light.shadow.camera.isOrthographicCamera) {
    Object.assign(light.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.1, far: 30 });
  }
}

function lookLights(scene) {
  if (LOOK.lights.some((l) => l.kind === 'area')) RectAreaLightUniformsLib.init();
  return LOOK.lights.map((l) => {
    const light = LIGHT_BUILD[l.kind](l);
    light.position.set(l.x, l.y, l.z);
    if (light.target) scene.add(light.target);
    if (light.isRectAreaLight) light.lookAt(0, 0, 0);
    if (LOOK.softShadows && l.castShadow && CASTS[l.kind]) castShadow(light);
    scene.add(light);
    return { spec: l, light };
  });
}

function presetLights(scene, c) {
  const light = LIGHTING[c.lighting] || LIGHTING.studio;
  scene.add(new THREE.AmbientLight(0xffffff, LOOK ? light.ambient * 0.25 : light.ambient));
  const dim = LOOK ? 0.5 : 1;
  const key = new THREE.DirectionalLight(0xffffff, light.key * dim); key.position.set(3, 4, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, light.fill * dim); fill.position.set(-4, 2, -3); scene.add(fill);
  if (LOOK && LOOK.softShadows) castShadow(key);
  return [];
}

let hdriTexture = null;
function hdri() {
  if (!LOOK || !LOOK.hdri) return Promise.resolve(null);
  if (!hdriTexture) hdriTexture = new Promise((resolve) => new HDRLoader().load(LOOK.hdri, (t) => { t.mapping = THREE.EquirectangularReflectionMapping; resolve(t); }, undefined, () => resolve(null)));
  return hdriTexture;
}

function environment(s) {
  if (!LOOK || LOOK.environment.preset === 'none') return Promise.resolve();
  s.scene.environmentIntensity = LOOK.environment.intensity;
  s.scene.environmentRotation.set(0, LOOK.environment.rotation * DEG, 0);
  const pmrem = new THREE.PMREMGenerator(s.renderer);
  if (!LOOK.hdri) {
    s.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    return Promise.resolve();
  }
  return hdri().then((t) => { if (t) s.scene.environment = pmrem.fromEquirectangular(t).texture; });
}

function contactBlob() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = FLOOR + 0.001;
  return blob;
}

const CATCHER = 8;
const FADE_FROM = 0.4;
const FADE_TO = 1.25;

function fadingShadow() {
  const material = new THREE.ShadowMaterial({ opacity: 0.32 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\\nvarying vec2 vFloor;').replace('#include <begin_vertex>', '#include <begin_vertex>\\nvFloor = position.xy;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\\nvarying vec2 vFloor;').replace('#include <fog_fragment>', 'gl_FragColor.a *= 1.0 - smoothstep(' + FADE_FROM.toFixed(2) + ', ' + FADE_TO.toFixed(2) + ', length(vFloor));\\n#include <fog_fragment>');
  };
  return material;
}

function ground(scene, c) {
  if (!c.shadow) return;
  if (!LOOK) {
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = FLOOR; scene.add(shadow);
    return;
  }
  if (LOOK.softShadows) {
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(CATCHER, CATCHER), fadingShadow());
    catcher.rotation.x = -Math.PI / 2; catcher.position.y = FLOOR; catcher.receiveShadow = true; scene.add(catcher);
  }
  if (LOOK.contactShadow) scene.add(contactBlob());
}

function stage(c) {
  const renderer = keptRenderer('three-' + c.id, (canvas) => new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true }));
  if (!renderer) return null;
  const canvas = renderer.domElement;
  renderer.setPixelRatio(1);
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = false;
  if (LOOK) {
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = LOOK.softShadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, canvas.width / canvas.height, 0.1, 100);
  camera.position.set(0, 0.3, 4.6 / c.zoom);
  const lights = LOOK && LOOK.lights.length ? lookLights(scene) : presetLights(scene, c);
  ground(scene, c);
  const pivot = new THREE.Group();
  const object = new THREE.Group();
  pivot.add(object);
  scene.add(pivot);
  return { renderer, scene, camera, pivot, object, lights, bokeh: STAGE && STAGE.dof && c.depth !== null ? bokeh(canvas) : null };
}

function dressed(c, base) {
  if (!c.surface) return base;
  return new THREE.MeshPhysicalMaterial({ color: base && base.color ? base.color : new THREE.Color(c.color), map: base ? base.map : null, ...c.surface });
}

function finish(root, c) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (c.surface) o.material = Array.isArray(o.material) ? o.material.map((m) => dressed(c, m)) : dressed(c, o.material);
  });
}

function fitted(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = FIT / Math.max(size.x, size.y, size.z, 1e-6);
  root.scale.multiplyScalar(scale);
  root.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  return root;
}

function extruded(shapes, c) {
  const unit = spanOf(shapes) / FIT;
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: c.extrude * unit, bevelEnabled: c.bevel > 0, bevelThickness: c.bevel * unit, bevelSize: c.bevel * unit * 0.6, bevelSegments: 4, curveSegments: 16 });
  geo.rotateX(Math.PI);
  const material = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(c.color), ...(c.surface || { roughness: 0.4 }) });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, material));
  return group;
}

function spanOf(shapes) {
  const box = new THREE.Box2();
  shapes.forEach((s) => s.getPoints().forEach((p) => box.expandByPoint(p)));
  const size = box.getSize(new THREE.Vector2());
  return Math.max(size.x, size.y, 1e-6);
}

function loadModel(c, s) {
  return new Promise((resolve) => {
    if (!c.url) return resolve();
    new GLTFLoader().load(c.url, (gltf) => {
      finish(gltf.scene, c);
      s.object.add(fitted(gltf.scene));
      resolve();
    }, undefined, () => resolve());
  });
}

function loadLogo(c, s) {
  return new Promise((resolve) => {
    if (!c.url) return resolve();
    new SVGLoader().load(c.url, (data) => {
      const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
      if (!shapes.length) return resolve();
      const root = extruded(shapes, c);
      finish(root, c);
      s.object.add(fitted(root));
      resolve();
    }, undefined, () => resolve());
  });
}

function textShapes(font, text) {
  const path = font.getPath(text, 0, 0, 100);
  const shapePath = new THREE.ShapePath();
  for (const cmd of path.commands) {
    if (cmd.type === 'M') shapePath.moveTo(cmd.x, cmd.y);
    else if (cmd.type === 'L') shapePath.lineTo(cmd.x, cmd.y);
    else if (cmd.type === 'Q') shapePath.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
    else if (cmd.type === 'C') shapePath.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
  }
  shapePath.userData = { style: { fillRule: 'nonzero' } };
  return SVGLoader.createShapes(shapePath);
}

function fontFile(url) {
  const files = (window[FONT_CACHE] = window[FONT_CACHE] || {});
  if (!files[url]) files[url] = fetch(url).then((r) => r.arrayBuffer()).catch((e) => { delete files[url]; throw e; });
  return files[url];
}

function loadText(c, s) {
  if (!c.url || !c.text.trim()) return Promise.resolve();
  return import('opentype')
    .then((mod) => fontFile(c.url).then((buf) => (mod.default || mod).parse(buf)))
    .then((font) => {
      const shapes = textShapes(font, c.text);
      if (!shapes.length) return;
      const root = extruded(shapes, c);
      finish(root, c);
      s.object.add(fitted(root));
    })
    .catch(() => undefined);
}

${DEVICE_SCRIPT}
const LOADERS = {
  device: loadDevice,
  model: loadModel,
  logo: loadLogo,
  text: loadText,
  shape: (c, s) => {
    const mesh = new THREE.Mesh(geometry[c.shape](), new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.35, metalness: 0.1 }));
    const root = new THREE.Group();
    root.add(mesh);
    finish(root, c);
    s.object.add(root);
    s.pivot.rotation.set(0.35, 0, 0.1);
    return Promise.resolve();
  }
};

const scenes = CLIPS.map((c) => {
  const s = stage(c);
  if (!s) return null;
  return { c, s, ready: Promise.all([LOADERS[c.kind](c, s), environment(s)]) };
}).filter(Boolean);
dropUnused('three-', CLIPS.map((c) => 'three-' + c.id));
${ON_DISPOSE}(() => {
  live = false;
  for (const { s } of scenes) {
    disposeScene(s.scene);
    if (s.bokeh) {
      s.bokeh.target.dispose();
      disposeScene(s.bokeh.scene);
    }
  }
});

function legacyOrbit(c, local) {
  const t = window.${ENGINE_GLOBAL}.parseEase(c.ease)(c.length > 0 ? local / c.length : 1);
  return c.startAngle + (c.endAngle - c.startAngle) * t + c.orbitSpeed * local;
}

function lightAt(spec, key, frame) {
  return spec.keyframes[key] ? sampleTrack(spec.keyframes[key], frame) : spec[key];
}

const screens = () => scenes.map(({ c, s }) => (s.device ? screenKey(deviceSource(c, s), 0) : '')).join(',');
const painter = drawOnce(drawAt, screens);
const renderAt = (time) => painter.at(time);
const redraw = (time) => painter.again(time);
window.${THREE_REDRAW} = renderAt;

function drawAt(time) {
  if (!live) return;
  for (const { c, s } of scenes) {
    if (!onScreen(c, time)) continue;
    const local = Math.min(Math.max(time - c.start, 0), c.length);
    const at = (key, fallback) => (c.keys[key] ? sampleTrack(c.keys[key], local * c.fps) : fallback);
    for (const { spec, light } of s.lights) {
      const frame = time * c.fps;
      light.intensity = lightAt(spec, 'intensity', frame);
      light.position.set(lightAt(spec, 'x', frame), lightAt(spec, 'y', frame), lightAt(spec, 'z', frame));
      if (light.isRectAreaLight) light.lookAt(0, 0, 0);
    }
    updateDevice(c, s, at);
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
window.__hf.buildReady['motion-three'] = Promise.all(scenes.map((x) => x.ready)).then(() => redraw(window.__hfThreeTime || 0));
${hotSeek('renderAt')}
const tl = window.__timelines && window.__timelines.main;
DRIVER
renderAt(window.__hfThreeTime || 0);
`;

export function threeScript(clips: ThreeClip[], duration: number, stage: StageSpec | null, look: LookRuntime | null = null): string {
  if (!clips.length) {
    return '';
  }
  return `<script type="module">const CLIPS = ${js(clips)};const LIGHTING = ${js(LIGHTING)};const LOOK = ${js(look)};const DURATION = ${js(duration)};const FOV = ${SCENE.fov.fallback};const STAGE = ${js(stage)};${cameraRuntime()}const sampleTrack = (${sampleTrack.toString()});const onScreen = (${onScreen.toString()});const drawOnce = (${drawOnce.toString()});const screenKey = (${screenKey.toString()});${SCENE_SCRIPT.replace('DRIVER', seekDriver(THREE_TIMELINE, 'DURATION', 'renderAt'))}</script>`;
}
