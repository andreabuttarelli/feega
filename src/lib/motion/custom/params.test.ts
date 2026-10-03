// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import gsap from 'gsap';
import { MotionFormat, findClip, newMotionDoc, parseMotionDoc, type MotionDoc } from '../doc';
import { addClip, setKeyframes, setProps, type OpResult } from '../timeline';
import { Ease } from '../design';
import { FEEGA_TOKENS } from '../brand';
import { composeHtml } from '../hyperframes/compose';
import { clipFieldGroups, valueAt } from '../inspector';
import { Control } from '../components';
import { writeComponent } from './ops';
import { extractParams, withParams } from './params';
import { ERRORS, REGISTRY, bootScript, definitionScript, seedOf } from './runtime';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const JS = `
const speed = param('speed', 1.5, { type: 'number', min: 0, max: 4, step: 0.1, label: 'Speed', group: 'Motion' });
const accent = param('accent', 'brand.accent', { type: 'color', group: 'Style' });
param('title', 'Spring drop', { type: 'text' });
param('live', true, { type: 'boolean' });
param('layout', 'grid', { type: 'select', options: ['grid', 'list'] });
param('picture', null, { type: 'asset', kind: 'image' });
param('face', 'sans', { type: 'font' });
param('curve', 'power2.out', { type: 'ease' });
tl.to(root, { x: 100 * speed, duration: 1 });
`;

const draft = { source: { html: '<b></b>', css: '.x{color:var(--param-accent)}', js: JS }, propsSchema: { type: 'object' as const, properties: {} } };

describe('params declared in code', () => {
  it('are extracted from the param() calls into the props schema', () => {
    const props = extractParams(JS);

    expect(Object.keys(props)).toEqual(['speed', 'accent', 'title', 'live', 'layout', 'picture', 'face', 'curve']);
    expect(props.speed).toMatchObject({ type: 'number', default: 1.5, minimum: 0, maximum: 4, step: 0.1, title: 'Speed', group: 'Motion' });
    expect(props.accent).toMatchObject({ type: 'string', format: 'color', default: 'brand.accent', group: 'Style' });
    expect(props.layout).toMatchObject({ type: 'string', enum: ['grid', 'list'], default: 'grid' });
    expect(props.picture).toMatchObject({ type: 'string', format: 'asset', assetKind: 'image' });
    expect(props.face.enum).toContain('sans');
    expect(props.curve.enum).toContain('power2.out');
  });

  it('refresh the schema on every write, so the agent never maintains it by hand', () => {
    const doc = must(writeComponent(newMotionDoc(MotionFormat.Landscape), 'Grid', draft));
    const edited = must(writeComponent(doc, 'Grid', { ...draft, source: { ...draft.source, js: "param('gap', 8, { type: 'number', min: 0, max: 40 });" } }));

    expect(Object.keys(doc.components.Grid.propsSchema.properties)).toContain('speed');
    expect(Object.keys(edited.components.Grid.propsSchema.properties)).toEqual(['gap']);
  });

  it('refuse a param whose name or options are not literals', () => {
    expect(writeComponent(newMotionDoc(MotionFormat.Landscape), 'Bad', { ...draft, source: { ...draft.source, js: 'const n = "x"; param(n, 1);' } }).ok).toBe(false);
  });

  it('become inspector controls grouped by their group, without re-running the agent', () => {
    const doc = must(addClip(must(writeComponent(newMotionDoc(MotionFormat.Landscape), 'Grid', draft)), { component: 'Custom', from: 0, props: { name: 'Grid' } }, 'g'));
    const groups = clipFieldGroups(doc, findClip(doc, 'g')!.clip);

    expect(groups.map((g) => g.group)).toEqual(['Content', 'Style', 'Motion']);
    expect(groups.flatMap((g) => g.fields).find((f) => f.key === 'face')?.control).toBe(Control.Select);
    expect(must(setProps(doc, 'g', { speed: 3 })).tracks[0].clips[0].props).toMatchObject({ speed: 3 });
  });
});

describe('keyframed params', () => {
  const base = must(addClip(must(writeComponent(newMotionDoc(MotionFormat.Landscape), 'Grid', draft)), { component: 'Custom', from: 30, durationInFrames: 90, props: { name: 'Grid' } }, 'g'));
  const keyed = must(
    setKeyframes(base, 'g', 'speed', [
      { frame: 0, value: 0, ease: Ease.Linear },
      { frame: 30, value: 4, ease: Ease.Linear }
    ])
  );

  it('number and colour params take keyframes like built-in props; text does not', () => {
    expect(setKeyframes(base, 'g', 'accent', [{ frame: 0, value: '#ff0000', ease: Ease.Linear }]).ok).toBe(true);
    expect(setKeyframes(base, 'g', 'title', [{ frame: 0, value: 1, ease: Ease.Linear }]).ok).toBe(false);
    expect(setKeyframes(base, 'g', 'speed', [{ frame: 0, value: 9, ease: Ease.Linear }]).ok).toBe(false);
    expect(parseMotionDoc(keyed).ok).toBe(true);
  });

  it('the inspector shows the interpolated value at the playhead', () => {
    const clip = withParams(keyed, findClip(keyed, 'g')!.clip);

    expect(valueAt(clip, 'speed', 45, (v) => v)).toBe(2);
  });

  it('reach the composition as tracks in clip seconds', () => {
    expect(composeHtml({ doc: keyed, tokens: FEEGA_TOKENS, assets: {} })).toContain('"keys":{"speed":[{"at":0,"value":0,"ease":"none"},{"at":1,"value":4,"ease":"none"}]}');
  });
});

const SUPPRESS_EVENTS = true;

describe('param injection at runtime', () => {
  afterEach(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w[REGISTRY];
    delete w[ERRORS];
  });

  function boot(js: string, keys: Record<string, { at: number; value: number | string; ease: string }[]> = {}) {
    document.body.innerHTML = '<div id="cc-c1"></div>';
    const w = window as unknown as Record<string, unknown>;
    w.gsap = gsap;
    const master = gsap.timeline({ paused: true });
    w.__master = master;
    window.eval(definitionScript('P', js).replace(/^<script>|<\/script>$/g, ''));
    window.eval(bootScript([{ id: 'c1', name: 'P', start: 0, length: 2, fps: 30, values: { speed: 1, accent: '#0099ff' }, seed: seedOf('c1'), keys }], { assets: {}, brand: { name: 'f', colors: {}, logoUrl: null } }, 'window.__master'));
    return { master, root: document.getElementById('cc-c1')! };
  }

  it('param() returns the clip value and the root carries it as a CSS custom property', () => {
    const { root } = boot("root.dataset.v = String(param('speed', 9));");

    expect(root.dataset.v).toBe('1');
    expect(root.style.getPropertyValue('--param-speed')).toBe('1');
    expect(root.style.getPropertyValue('--param-accent')).toBe('#0099ff');
  });

  it('a keyframed param is interpolated per frame and lands the same from any seek', () => {
    const js = "const dot = document.createElement('i'); root.appendChild(dot); tl.to({}, { duration: 2, onUpdate() { dot.dataset.s = String(props.speed); } }, 0);";
    const { master, root } = boot(js, { speed: [{ at: 0, value: 0, ease: 'none' }, { at: 1, value: 4, ease: 'none' }] });
    const dot = root.querySelector('i') as HTMLElement;

    master.totalTime(0.5, SUPPRESS_EVENTS);
    const forward = [dot.dataset.s, root.style.getPropertyValue('--param-speed')];
    master.totalTime(1.9, SUPPRESS_EVENTS);
    master.totalTime(0.5, SUPPRESS_EVENTS);

    expect(forward).toEqual(['2', '2']);
    expect([dot.dataset.s, root.style.getPropertyValue('--param-speed')]).toEqual(forward);
  });
});
