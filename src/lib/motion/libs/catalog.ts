export const MOTION_LIBS_ROUTE = '/motion-libs';
export const APP_ORIGIN = 'https://feega.app';
export const HYPERFRAMES_VERSION = '0.8.114';
export const THREE_VERSION = '0.181.2';

export enum Licence {
  Mit = 'MIT',
  Isc = 'ISC',
  Lgpl = 'LGPL-2.1',
  Apache = 'Apache-2.0'
}

export enum Packing {
  Copy = 'copy',
  Iife = 'iife'
}

export enum Script {
  Runtime = 'runtime',
  Player = 'player',
  Screenshot = 'screenshot',
  Lottie = 'lottie',
  D3 = 'd3',
  P5 = 'p5',
  Pixi = 'pixi',
  PixiEval = 'pixi-unsafe-eval',
  Matter = 'matter',
  LittleJS = 'littlejs',
  Kaplay = 'kaplay',
  Three = 'three'
}

export type Hosted = { name: string; version: string; pkg: string; source: string; file: string; licence: Licence; licenceFile: string; home: string; packing: Packing; global?: string };

export const THREE_GLOBAL = '__feegaThree';
export const LITTLEJS_GLOBAL = '__feegaLittleJS';

const THREE = { name: 'three', version: THREE_VERSION, pkg: 'motion-three', licence: Licence.Mit, licenceFile: 'LICENSE', home: 'https://github.com/mrdoob/three.js' };

export const HOSTED: Record<Script, Hosted> = {
  [Script.Runtime]: { name: '@hyperframes/core', version: HYPERFRAMES_VERSION, pkg: '@hyperframes/core', source: 'dist/hyperframe.runtime.iife.js', file: 'hyperframe.runtime.iife.js', licence: Licence.Apache, licenceFile: 'LICENSE', home: 'https://github.com/heygen-com/hyperframes', packing: Packing.Copy },
  [Script.Player]: { name: '@hyperframes/player', version: HYPERFRAMES_VERSION, pkg: '@hyperframes/player', source: 'dist/hyperframes-player.global.js', file: 'hyperframes-player.global.js', licence: Licence.Apache, licenceFile: 'LICENSE', home: 'https://github.com/heygen-com/hyperframes', packing: Packing.Copy },
  [Script.Screenshot]: { name: 'html-to-image', version: '1.11.13', pkg: 'html-to-image', source: 'dist/html-to-image.js', file: 'html-to-image.js', licence: Licence.Mit, licenceFile: 'LICENSE', home: 'https://github.com/bubkoo/html-to-image', packing: Packing.Copy },
  [Script.Lottie]: { name: 'lottie-web', version: '5.13.0', pkg: 'lottie-web', source: 'build/player/lottie_light.min.js', file: 'lottie_light.min.js', licence: Licence.Mit, licenceFile: 'LICENSE.md', home: 'https://github.com/airbnb/lottie-web', packing: Packing.Copy },
  [Script.D3]: { name: 'd3', version: '7.9.0', pkg: 'd3', source: 'dist/d3.min.js', file: 'd3.min.js', licence: Licence.Isc, licenceFile: 'LICENSE', home: 'https://github.com/d3/d3', packing: Packing.Copy },
  [Script.P5]: { name: 'p5', version: '1.11.11', pkg: 'p5', source: 'lib/p5.min.js', file: 'p5.min.js', licence: Licence.Lgpl, licenceFile: 'license.txt', home: 'https://github.com/processing/p5.js', packing: Packing.Copy },
  [Script.Pixi]: { name: 'pixi.js', version: '7.4.3', pkg: 'pixi.js', source: 'dist/pixi.min.js', file: 'pixi.min.js', licence: Licence.Mit, licenceFile: 'LICENSE', home: 'https://github.com/pixijs/pixijs', packing: Packing.Copy },
  [Script.PixiEval]: { name: '@pixi/unsafe-eval', version: '7.4.3', pkg: '@pixi/unsafe-eval', source: 'dist/unsafe-eval.min.js', file: 'unsafe-eval.min.js', licence: Licence.Mit, licenceFile: 'LICENSE', home: 'https://github.com/pixijs/pixijs', packing: Packing.Copy },
  [Script.Matter]: { name: 'matter-js', version: '0.20.0', pkg: 'matter-js', source: 'build/matter.min.js', file: 'matter.min.js', licence: Licence.Mit, licenceFile: 'LICENSE', home: 'https://github.com/liabru/matter-js', packing: Packing.Copy },
  [Script.LittleJS]: { name: 'littlejsengine', version: '1.26.1', pkg: 'littlejsengine', source: 'dist/littlejs.esm.min.js', file: 'littlejs.iife.js', licence: Licence.Mit, licenceFile: 'LICENSE', home: 'https://github.com/KilledByAPixel/LittleJS', packing: Packing.Iife, global: LITTLEJS_GLOBAL },
  [Script.Kaplay]: { name: 'kaplay', version: '3001.0.19', pkg: 'kaplay', source: 'dist/kaplay.js', file: 'kaplay.js', licence: Licence.Mit, licenceFile: 'LICENSE.md', home: 'https://github.com/kaplayjs/kaplay', packing: Packing.Copy },
  [Script.Three]: { ...THREE, source: 'build/three.module.js', file: 'three.iife.js', packing: Packing.Iife, global: THREE_GLOBAL }
};

export const OPENTYPE: Hosted = { name: 'opentype.js', version: '1.3.4', pkg: 'opentype.js', source: 'dist/opentype.module.js', file: 'opentype.module.js', licence: Licence.Mit, licenceFile: 'LICENSE', home: 'https://github.com/opentypejs/opentype.js', packing: Packing.Copy };

export enum Module {
  Three = 'three',
  Gltf = 'three/addons/loaders/GLTFLoader.js',
  Svg = 'three/addons/loaders/SVGLoader.js',
  Hdr = 'three/addons/loaders/HDRLoader.js',
  Room = 'three/addons/environments/RoomEnvironment.js',
  RectArea = 'three/addons/lights/RectAreaLightUniformsLib.js',
  Opentype = 'opentype'
}

export type HostedModule = { lib: typeof THREE | Hosted; source: string; file: string };

const ADDONS = 'esm/addons/';
const addon = (path: string): HostedModule => ({ lib: THREE, source: `examples/jsm/${path}`, file: `${ADDONS}${path}` });

export const MODULES: Record<Module, HostedModule> = {
  [Module.Three]: { lib: THREE, source: 'build/three.module.js', file: 'esm/three.module.js' },
  [Module.Gltf]: addon('loaders/GLTFLoader.js'),
  [Module.Svg]: addon('loaders/SVGLoader.js'),
  [Module.Hdr]: addon('loaders/HDRLoader.js'),
  [Module.Room]: addon('environments/RoomEnvironment.js'),
  [Module.RectArea]: addon('lights/RectAreaLightUniformsLib.js'),
  [Module.Opentype]: { lib: OPENTYPE, source: OPENTYPE.source, file: `esm/${OPENTYPE.file}` }
};

export const MODULE_EXTERNAL = Module.Three;

export const folderOf = (lib: { name: string; version: string }) => `${lib.name.replace(/^@/, '').replace('/', '-')}@${lib.version}`;

export const libsBase = (origin: string) => `${origin}${MOTION_LIBS_ROUTE}`;

export const hostedUrl = (origin: string, lib: Hosted) => `${libsBase(origin)}/${folderOf(lib)}/${lib.file}`;

export const scriptUrl = (origin: string, script: Script) => hostedUrl(origin, HOSTED[script]);

export const moduleUrl = (origin: string, module: Module) => `${libsBase(origin)}/${folderOf(MODULES[module].lib)}/${MODULES[module].file}`;

const CDN = 'https://cdn.jsdelivr.net/npm/';
const cdnUrl = (lib: Hosted) => `${CDN}${lib.name}@${lib.version}/${lib.source}`;
const CDN_THREE = `${CDN}three@${THREE_VERSION}/`;

export function cdnRewrites(origin: string): [string, string][] {
  const three = `${libsBase(origin)}/${folderOf(THREE)}/`;
  const scripts = Object.values(Script).filter((script) => HOSTED[script].packing === Packing.Copy).map((script): [string, string] => [cdnUrl(HOSTED[script]), scriptUrl(origin, script)]);
  return [...scripts, [`${CDN_THREE}build/three.module.js`, moduleUrl(origin, Module.Three)], [cdnUrl(OPENTYPE), moduleUrl(origin, Module.Opentype)], [`${CDN_THREE}examples/jsm/`, `${three}${ADDONS}`], [CDN_THREE, three]];
}

export const defaultOrigin = () => globalThis.location?.origin ?? APP_ORIGIN;

export function notice(lib: Hosted): string {
  return `${lib.name}@${lib.version} | ${lib.licence} | ${lib.home}`;
}
