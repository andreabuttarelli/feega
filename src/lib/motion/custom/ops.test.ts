import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc, type MotionDoc } from '../doc';
import { addClip, setProps, type OpResult } from '../timeline';
import { CheckState, ComponentMode, sourceHash } from './component';
import { patchComponent, recordCheck, removeComponent, writeComponent } from './ops';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const NODES = {
  source: { html: '<div class="n"></div>', css: '.n{width:10px}', js: 'tl.from(root,{opacity:0,duration:0.5});' },
  propsSchema: { type: 'object' as const, properties: { title: { type: 'string' as const, default: 'Brief' }, count: { type: 'number' as const, default: 3, minimum: 1, maximum: 8 } } }
};

const withNodes = () => must(writeComponent(newMotionDoc(MotionFormat.Landscape), 'NodeGraph', NODES));

describe('custom component ops', () => {
  it('writes a component and a clip can use it with its defaults', () => {
    const doc = must(addClip(withNodes(), { component: 'Custom', from: 0, props: { name: 'NodeGraph' } }, 'c1'));

    expect(doc.tracks[0].clips[0].props).toEqual({ name: 'NodeGraph', title: 'Brief', count: 3 });
  });

  it('refuses a clip of a component the video does not have', () => {
    const result = addClip(withNodes(), { component: 'Custom', from: 0, props: { name: 'ChatPanel' } }, 'c1');

    expect(!result.ok && result.error).toContain('this video has NodeGraph');
  });

  it('validates a custom clip prop against the props schema', () => {
    const doc = must(addClip(withNodes(), { component: 'Custom', from: 0, props: { name: 'NodeGraph' } }, 'c1'));

    expect(setProps(doc, 'c1', { count: 20 }).ok).toBe(false);
    expect(must(setProps(doc, 'c1', { count: 5 })).tracks[0].clips[0].props).toMatchObject({ count: 5 });
  });

  it('refuses code that breaks the authoring contract, saying what to change', () => {
    const result = writeComponent(newMotionDoc(MotionFormat.Landscape), 'Ticker', { ...NODES, source: { ...NODES.source, js: 'setInterval(tick, 16);' } });

    expect(!result.ok && result.error).toContain('setInterval');
  });

  it('bumps the version and clears the check on every rewrite', () => {
    const passed = must(recordCheck(withNodes(), 'NodeGraph', { hash: sourceHash(NODES), state: CheckState.Passed, problems: [] }));
    const rewritten = must(writeComponent(passed, 'NodeGraph', { ...NODES, source: { ...NODES.source, css: '.n{width:20px}' } }));

    expect(rewritten.components.NodeGraph.version).toBe(2);
    expect(rewritten.components.NodeGraph.check).toBeNull();
  });

  it('patches one file by replacing text that occurs exactly once', () => {
    const doc = must(patchComponent(withNodes(), 'NodeGraph', [{ file: 'css', find: 'width:10px', replace: 'width:12px' }]));

    expect(doc.components.NodeGraph.source.css).toBe('.n{width:12px}');
  });

  it('refuses a patch whose text is missing or ambiguous', () => {
    expect(patchComponent(withNodes(), 'NodeGraph', [{ file: 'css', find: 'height', replace: '' }]).ok).toBe(false);
    expect(patchComponent(withNodes(), 'NodeGraph', [{ file: 'html', find: 'div', replace: 'span' }]).ok).toBe(false);
  });

  it('keeps clip values valid when a rewrite narrows the props schema', () => {
    const doc = must(addClip(withNodes(), { component: 'Custom', from: 0, props: { name: 'NodeGraph', count: 8 } }, 'c1'));
    const narrowed = must(writeComponent(doc, 'NodeGraph', { ...NODES, propsSchema: { type: 'object', properties: { count: { type: 'number', default: 2, maximum: 4 } } } }));

    expect(narrowed.tracks[0].clips[0].props).toEqual({ name: 'NodeGraph', count: 2 });
    expect(parseMotionDoc(narrowed).ok).toBe(true);
  });

  it('refuses to remove a component clips still use', () => {
    const doc = must(addClip(withNodes(), { component: 'Custom', from: 0, props: { name: 'NodeGraph' } }, 'c1'));

    expect(removeComponent(doc, 'NodeGraph').ok).toBe(false);
    expect(must(removeComponent(withNodes(), 'NodeGraph')).components).toEqual({});
  });
});

describe('a live component', () => {
  const loop = { ...NODES, source: { ...NODES.source, js: 'requestAnimationFrame(function f() { root.dataset.r = String(Math.random()); requestAnimationFrame(f); });' } };

  it('is refused as deterministic and written as live', () => {
    expect(writeComponent(newMotionDoc(MotionFormat.Landscape), 'Game', loop).ok).toBe(false);
    expect(must(writeComponent(newMotionDoc(MotionFormat.Landscape), 'Game', { ...loop, mode: ComponentMode.Live })).components.Game.mode).toBe(ComponentMode.Live);
  });

  it('stays live through a patch', () => {
    const doc = must(writeComponent(newMotionDoc(MotionFormat.Landscape), 'Game', { ...loop, mode: ComponentMode.Live }));

    expect(must(patchComponent(doc, 'Game', [{ file: 'js', find: 'f()', replace: 'g()' }])).components.Game.mode).toBe(ComponentMode.Live);
  });
});

