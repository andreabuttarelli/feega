import { describe, expect, it } from 'vitest';
import { FPS } from '../design';
import { LIGHTING, threeScript, ThreeKind, type ThreeClip } from '../hyperframes/three';
import { SCENE } from '../keyframes';
import { addBreakpoint, BreakpointPreset } from '../breakpoints/model';
import { CodeTarget, exportCode, type CodeExport } from './index';
import { RIG } from './scene3d';
import { MODEL_ASSET, MODEL_URL, SCENE_ASSETS, sceneDoc } from './fixtures/scene3d';

const LIB = '$lib';

const file = (out: CodeExport, path: string) => {
  const found = out.files.find((f) => f.path === path);
  if (!found) {
    throw new Error(`${path} is not in ${out.files.map((f) => f.path).join(', ')}`);
  }
  return found.content;
};

const specOf = (out: CodeExport, path: string, name: string) => {
  const data = file(out, path);
  const body = data.match(new RegExp(`export const ${name}[^=]*= (\\{[\\s\\S]*?\\n\\});`))?.[1];
  if (!body) {
    throw new Error(`no ${name} in ${path}`);
  }
  return JSON.parse(body);
};

const react = () => exportCode(sceneDoc(), { name: 'Toy', assets: SCENE_ASSETS });
const html = () => exportCode(sceneDoc(), { name: 'Toy', target: CodeTarget.Html, assets: SCENE_ASSETS });
const svelte = () => exportCode(sceneDoc(), { name: 'Toy', target: CodeTarget.Svelte, assets: SCENE_ASSETS });

describe('a frame with a 3D model', () => {
  it('is no longer reported as left out', () => {
    for (const out of [react(), html(), svelte()]) {
      expect(out.notes.join('\n')).not.toContain('Model3D');
    }
  });

  it('ships the model file like an image', () => {
    expect(react().assets).toEqual([{ path: 'public/assets/toy-model.glb', ref: '/assets/toy-model.glb', url: MODEL_URL }]);
    expect(html().assets).toEqual([{ path: 'assets/toy-model.glb', ref: 'assets/toy-model.glb', url: MODEL_URL }]);
    expect(svelte().assets).toEqual([{ path: 'static/assets/toy-model.glb', ref: '/assets/toy-model.glb', url: MODEL_URL }]);
    expect(MODEL_ASSET).toBe('toy-model');
  });

  it('React renders it with React Three Fiber inside the layer box', () => {
    const out = react();
    const page = file(out, 'src/pages/Toy.tsx');

    expect(page).toContain("import { Scene3D } from '../components/Scene3D';");
    expect(page).toContain("import { toyModelScene } from '../scenes';");
    expect(page).toContain('<Scene3D scene={toyModelScene} />');
    expect(page).toMatch(/<div className="[^"]*w-\[43.75%\][^"]*h-150/);
    expect(file(out, 'src/components/Scene3D.tsx')).toContain("from '@react-three/fiber'");
  });

  it('React declares the three dependencies the component imports', () => {
    const pkg = JSON.parse(file(react(), 'package.json'));

    expect(pkg.dependencies).toMatchObject({ '@react-three/fiber': '^9.8.2', three: '0.181.2', react: '^19.0.0' });
    expect(pkg.devDependencies['@types/three']).toBe('0.181.0');
  });

  it('a page without 3D carries no three dependency', () => {
    const plain = exportCode({ ...sceneDoc(), tracks: [{ ...sceneDoc().tracks[0], clips: sceneDoc().tracks[0].clips.filter((c) => c.component !== 'Model3D') }] }, { name: 'Toy' });

    expect(JSON.parse(file(plain, 'package.json')).dependencies.three).toBeUndefined();
    expect(plain.files.map((f) => f.path)).not.toContain('src/scenes.ts');
  });

  it('HTML mounts it with a plain three.js module', () => {
    const out = html();
    const index = file(out, 'index.html');

    expect(index).toMatch(/<div class="toy-model" data-scene="toyModelScene"><\/div>/);
    expect(index).toContain('<script type="importmap">');
    expect(index).toContain('three@0.181.2');
    expect(index).toContain('<script type="module" src="scripts/scenes.js"></script>');
    expect(file(out, 'scripts/scenes.js')).toContain('new GLTFLoader()');
  });

  it('Svelte mounts it with an action over plain three.js', () => {
    const out = svelte();

    expect(file(out, 'src/routes/+page.svelte')).toContain('use:scene3d={toyModelScene}');
    expect(file(out, 'src/routes/+page.svelte')).toContain(`import { scene3d } from '${LIB}/scene3d';`);
    expect(file(out, 'src/routes/+page.svelte')).toContain(`import { toyModelScene } from '${LIB}/scenes';`);
    expect(JSON.parse(file(out, 'package.json')).dependencies.three).toBe('0.181.2');
  });

  it('all three targets carry the same numbers', () => {
    const a = specOf(react(), 'src/scenes.ts', "toyModelScene");
    const b = specOf(html(), 'scripts/scenes.js', "toyModelScene");
    const c = specOf(svelte(), 'src/lib/scenes.js', "toyModelScene");

    expect({ ...b, src: a.src }).toEqual(a);
    expect(c).toEqual(a);
    expect(b.src).toBe("assets/toy-model.glb");
  });
});

describe('the table from doc properties to three.js parameters', () => {
  const spec = () => specOf(react(), 'src/scenes.ts', "toyModelScene");

  it('puts the camera where the canvas puts it', () => {
    expect(spec().src).toBe('/assets/toy-model.glb');
    expect(spec().fov).toBe(SCENE.fov.fallback);
    expect(spec().dolly).toBe(1);
    expect(spec().rig).toEqual(RIG);
  });

  it('keeps the canvas lighting preset', () => {
    expect(spec().light).toEqual(LIGHTING.studio);
  });

  it('samples the orbit between the start and the end angle at every frame', () => {
    const orbit: number[] = spec().orbit;

    expect(orbit).toHaveLength(121);
    expect(orbit[0]).toBe(-30);
    expect(orbit[120]).toBe(150);
    expect(orbit[60]).toBeCloseTo(60, 1);
    expect(spec().fps).toBe(FPS);
  });

  it('turns a keyframed camera into samples of the same curve', () => {
    const out = exportCode(sceneDoc([{ id: 'zoom', component: 'Model3D', at: { left: 0, top: 0, width: 200, height: 200 }, props: { assetId: MODEL_ASSET }, keyframes: { dolly: [{ frame: 0, value: 1, ease: 'linear' }, { frame: 60, value: 2, ease: 'linear' }] } as never }]), { name: 'Toy', assets: SCENE_ASSETS });
    const zoom = specOf(out, 'src/scenes.ts', 'zoom');

    expect(zoom.dolly[0]).toBe(1);
    expect(zoom.dolly[30]).toBeCloseTo(1.5, 2);
    expect(zoom.dolly[120]).toBe(2);
    expect(out.notes.join('\n')).not.toContain('dolly');
  });

  it('matches the constants the canvas script draws with', () => {
    const clip = { id: 'a', kind: ThreeKind.Model, url: null, shape: 'cube', color: '#fff', start: 0, length: 4, startAngle: 0, endAngle: 0, orbitSpeed: 0, zoom: 1, lighting: 'studio', shadow: true, ease: 'none', fps: FPS, keys: {}, depth: null, surface: null, text: '', extrude: 0, bevel: 0, device: null, screenFit: 'cover', screen: null, video: false, overscan: 0, grains: [] } as ThreeClip;
    const script = threeScript([clip], 4, null);

    expect(script).toContain(`const FIT = ${RIG.fit};`);
    expect(script).toContain(`const FLOOR = ${RIG.floor};`);
    expect(script).toContain(`camera.position.set(0, ${RIG.height}, ${RIG.distance} / c.zoom)`);
    expect(script).toContain(`key.position.set(${RIG.key.join(', ')})`);
    expect(script).toContain(`fill.position.set(${RIG.fill.join(', ')})`);
    expect(script).toContain(`new THREE.CircleGeometry(${RIG.shadowRadius}, ${RIG.shadowSegments})`);
    expect(script).toContain(`opacity: ${RIG.shadowOpacity}`);
  });
});

describe('what the canvas shows that code cannot', () => {
  it('says so when the video has a lighting look', () => {
    const out = exportCode({ ...sceneDoc(), look: { lights: [], environment: { preset: 'room', intensity: 1, rotation: 0 }, softShadows: true, contactShadow: true } }, { name: 'Toy', assets: SCENE_ASSETS });

    expect(out.notes).toContain("Toy model: the video's lighting look (environment, custom lights, soft shadows) is not exported; the preset lights are used.");
  });

  it('says so for 3D layers that stay out', () => {
    const out = exportCode(sceneDoc([{ id: 'word', component: 'Text3D', at: { left: 0, top: 0, width: 200, height: 100 }, props: {} }]), { name: 'Toy', assets: SCENE_ASSETS });

    expect(out.notes).toContain('word: Text3D layers have no static HTML equivalent and were left out.');
  });

  it('says so when the layer has a background', () => {
    const doc = sceneDoc();
    doc.tracks[0].clips.forEach((c) => c.component === 'Model3D' && (c.props.backdrop = 'dark'));
    const out = exportCode(doc, { name: 'Toy', assets: SCENE_ASSETS });

    expect(out.notes).toContain("Toy model: the canvas paints this layer's background over the whole frame; in code it fills only the layer box.");
  });

  it('says so when no model is picked', () => {
    const doc = sceneDoc();
    doc.tracks[0].clips.forEach((c) => c.component === 'Model3D' && (c.props.assetId = null));
    const out = exportCode(doc, { name: 'Toy' });

    expect(out.notes).toContain('Toy model: no 3D model is picked, so the layer was left out.');
  });
});

describe('a 3D layer follows the layout like any box', () => {
  it('has one element across views, resized by a media query', () => {
    const doc = addBreakpoint(sceneDoc(), BreakpointPreset.Phone, 'ph');
    if (!doc.ok) {
      throw new Error(doc.error);
    }
    const out = exportCode(doc.doc, { name: 'Toy', target: CodeTarget.Html, assets: SCENE_ASSETS });

    expect(file(out, 'index.html').match(/data-scene="toyModelScene"/g)).toHaveLength(1);
    expect(file(out, 'styles/page.css')).toMatch(/\.toy-model \{[^}]*width: 43.75%;/);
  });
});
