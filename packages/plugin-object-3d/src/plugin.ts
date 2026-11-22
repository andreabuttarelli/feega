import type { PluginApi } from '@feega/plugin-api/client';
import { Control, Framework, OpKind, Place, frameworkOf, type Op, type ProjectInfo, type Selection, type Source, type UiNode } from '@feega/plugin-api/protocol';
import fontSource from './runtime/inter_bold.typeface.json?raw';
import licenceSource from './runtime/OFL.txt?raw';
import runtimeSource from './runtime/mount-scene.ts?raw';
import { COMPONENT_NAME, DEFAULT_SCENE, RUNTIME_FILE, attributeText, componentFor, sceneOf, type Scene } from './scene';

export const SECTION = 'scene';
export const THREE_VERSION = '^0.180.0';
export 
const LABEL = '3D object';
const SHAPE_PREFIX = 'shape:';
const MODEL_ACCEPT = ['.glb', '.gltf'];
const MODEL_SHAPE = 'model';
const TEXT_SHAPE = 'text';
const FONT_DIR = 'feega/fonts';
const MODEL_DIR = 'feega/models';
const FONT_FILE = 'inter_bold.typeface.json';
const LICENCE_FILE = 'OFL.txt';
const MAX_HEIGHT = 800;
const HEIGHT_STEP = 10;
const NOT_A_COMPONENT = 'Add a 3D object to a Svelte, React, Vue or Astro file.';

const SHAPES = new Set(['cube', 'sphere', 'torus', TEXT_SHAPE, MODEL_SHAPE]);
const MATERIALS = ['glass', 'metal', 'matte'];
const LIGHTS = ['studio', 'soft', 'dramatic'];

const sourceOf = (at: Source) => `${at.file}:${at.line}:${at.col}`;

const slug = (name: string) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9.-]/g, '');

const base64Of = (text: string) => btoa(unescape(encodeURIComponent(text)));

const options = (values: string[]) => values.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));

function treeOf(scene: Scene): UiNode[] {
  const material: UiNode[] = scene.shape === MODEL_SHAPE ? [{ type: Control.Note, text: 'Models keep their own materials.' }] : [{ type: Control.Select, id: 'material', label: 'Material', value: scene.material, options: options(MATERIALS) }];
  return [
    ...material,
    { type: Control.Select, id: 'lights', label: 'Lights', value: scene.lights, options: options(LIGHTS) },
    { type: Control.Toggle, id: 'autorotate', label: 'Auto-rotate', value: scene.autorotate === 'true' },
    { type: Control.Toggle, id: 'follow', label: 'Mouse follow', value: scene.follow === 'true' },
    { type: Control.Slider, id: 'height', label: 'Height', min: 0, max: MAX_HEIGHT, step: HEIGHT_STEP, value: Number(scene.height) || 0 },
    { type: Control.Colour, id: 'color', label: 'Colour', value: scene.color }
  ];
}

type Extras = { ops: Op[]; scene: Partial<Scene> };

export function objectPlugin(api: PluginApi) {
  const section = api.section(SECTION);
  let selection: Selection | null = null;
  let scene: Scene | null = null;

  async function show() {
    await section.render(scene ? treeOf(scene) : []);
  }

  async function pick(next: Selection | null) {
    selection = next;
    scene = next ? sceneOf(next.attributes) : null;
    await show();
  }

  async function modelOps(info: ProjectInfo): Promise<Extras | null> {
    const file = await api.pickFile(MODEL_ACCEPT);
    if (!file) {
      return null;
    }
    const name = slug(file.name);
    return { ops: [{ kind: OpKind.Asset, file: `${info.publicDir}/${MODEL_DIR}/${name}`, base64: file.base64 }], scene: { model: `/${MODEL_DIR}/${name}` } };
  }

  async function textOps(info: ProjectInfo): Promise<Extras | null> {
    const dir = `${info.publicDir}/${FONT_DIR}`;
    const ops: Op[] = [
      { kind: OpKind.Asset, file: `${dir}/${FONT_FILE}`, base64: base64Of(fontSource) },
      { kind: OpKind.Asset, file: `${dir}/${LICENCE_FILE}`, base64: base64Of(licenceSource) }
    ];
    return { ops, scene: { font: `/${FONT_DIR}/${FONT_FILE}` } };
  }

  const EXTRAS: Record<string, (info: ProjectInfo) => Promise<Extras | null>> = {
    [MODEL_SHAPE]: modelOps,
    [TEXT_SHAPE]: textOps
  };

  async function insert(shape: string, target: Source, place: Place | null) {
    const framework: Framework | null = frameworkOf(target.file);
    if (!framework) {
      await api.notify(NOT_A_COMPONENT);
      return;
    }
    const info = await api.project.info();
    const extras = (await EXTRAS[shape]?.(info)) ?? { ops: [], scene: {} };
    if (EXTRAS[shape] && !extras.ops.length) {
      return;
    }
    const component = componentFor(framework, info.typescript);
    const dependencies: Op[] = [{ kind: OpKind.Dependency, name: 'three', version: THREE_VERSION }, ...(info.typescript ? [{ kind: OpKind.Dependency as const, name: '@types/three', version: THREE_VERSION, dev: true }] : [])];
    await api.propose(LABEL, [
      ...dependencies,
      ...extras.ops,
      { kind: OpKind.Insert, at: sourceOf(target), place: place ?? Place.Auto, component: { name: COMPONENT_NAME, file: component.file, source: component.source, attributes: attributeText({ ...DEFAULT_SCENE, shape, ...extras.scene }) }, support: [{ file: RUNTIME_FILE, source: runtimeSource }] }
    ]);
  }

  async function change(id: string, value: string | number | boolean) {
    if (!selection || !scene) {
      return;
    }
    const written = id === 'height' && Number(value) === 0 ? '' : String(value);
    scene = { ...scene, [id]: written };
    await show();
    await api.propose(LABEL, [{ kind: OpKind.Attributes, ...(selection.component ? { at: sourceOf(selection.component) } : {}), tag: COMPONENT_NAME, set: { [id]: written } }]);
  }

  api.menu.on((item, target, place) => {
    const shape = item.slice(SHAPE_PREFIX.length);
    if (item.startsWith(SHAPE_PREFIX) && SHAPES.has(shape) && target) {
      void insert(shape, target, place);
    }
  });

  section.on((id, value) => void change(id, value));

  api.selection.watch(pick);
}
