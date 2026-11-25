import { afterEach, describe, expect, it, vi } from 'vitest';
import { BRIDGE_READY, FOCUSED, TRACKED, TREE_RESULT } from '../messages';
import { pageBridge } from './page-bridge';

const ORIGIN = 'http://localhost:5173';

function pageWindow() {
  const target = new EventTarget();
  vi.stubGlobal('window', target);
  vi.stubGlobal('location', { origin: ORIGIN });
  return (data: unknown) => target.dispatchEvent(Object.assign(new Event('message'), { data, origin: ORIGIN }));
}

afterEach(() => vi.unstubAllGlobals());

describe('tracked rects reach the view', () => {
  it('a rect that disappears is reported, so the outline cannot stay behind', () => {
    const post = pageWindow();
    const tracked: unknown[] = [];
    pageBridge(() => null, { tracked: (slot: string, rect: unknown) => tracked.push([slot, rect]) } as never);

    post({ type: TRACKED, slot: 'selected', rect: { x: 0, y: 0, width: 10, height: 10 } });
    post({ type: TRACKED, slot: 'selected', rect: null });

    expect(tracked).toEqual([
      ['selected', { x: 0, y: 0, width: 10, height: 10 }],
      ['selected', null]
    ]);
  });
});

describe('the page tab and the focus tab share one frame', () => {
  const frameWith = (posted: unknown[]) => ({ src: `${ORIGIN}/`, contentWindow: { postMessage: (message: unknown) => posted.push(message) } }) as unknown as HTMLIFrameElement;

  it('reports how many instances the page found', () => {
    const post = pageWindow();
    const counts: number[] = [];
    pageBridge(() => null, { focused: (count: number) => counts.push(count) } as never);

    post({ type: FOCUSED, count: 3 });

    expect(counts).toEqual([3]);
  });

  it('marks what it sends to the focus tab, and nothing it sends to the page', () => {
    const posted: unknown[] = [];
    pageWindow();
    const bridge = pageBridge(() => frameWith(posted), {} as never);

    bridge.tree();
    bridge.useFocus(true);
    bridge.tree();
    bridge.focus(null);
    bridge.focus({ file: 'a.tsx', line: 1, col: 2 }, false, 3);

    expect(posted).toEqual([{ type: 'feega:tree' }, { type: 'feega:tree', focus: true }, { type: 'feega:focus', source: null, shown: true }, { type: 'feega:focus', source: 'a.tsx:1:2', shown: false, index: 3 }]);
  });

  it('listens only to the tab that is showing', () => {
    const post = pageWindow();
    const trees: string[] = [];
    const bridge = pageBridge(() => null, { tree: (tree: unknown) => trees.push(String(tree)) } as never);

    post({ type: TREE_RESULT, tree: 'page' });
    post({ type: TREE_RESULT, tree: 'focus', focus: true });
    bridge.useFocus(true);
    post({ type: TREE_RESULT, tree: 'page again' });
    post({ type: TREE_RESULT, tree: 'focus again', focus: true });

    expect(trees).toEqual(['page', 'focus again']);
  });

  it('tells a page that is ready from a focus tab that is ready', () => {
    const post = pageWindow();
    const ready: string[] = [];
    pageBridge(() => null, { ready: () => ready.push('page'), focusReady: () => ready.push('focus') } as never);

    post({ type: BRIDGE_READY, path: '/' });
    post({ type: BRIDGE_READY, focus: true });

    expect(ready).toEqual(['page', 'focus']);
  });
});

describe('the real component in the focus tab', () => {
  it('says whether the focus tab shows the real component or a snapshot, and why', () => {
    const post = pageWindow();
    const seen: unknown[] = [];
    pageBridge(() => null, { focused: (...args: unknown[]) => seen.push(args) } as never);

    post({ type: FOCUSED, count: 1, mode: 'mount' });
    post({ type: FOCUSED, count: 1, mode: 'snapshot', reason: 'mount_error', detail: 'provider' });

    expect(seen).toEqual([[1, 'mount', undefined, undefined, undefined], [1, 'snapshot', 'mount_error', 'provider', undefined]]);
  });

  it('hands over whether the page behind the focus is dark, and the zoom it reports', () => {
    const post = pageWindow();
    const seen: unknown[] = [];
    pageBridge(() => null, { focused: (...args: unknown[]) => seen.push(args), zoomed: (zoom: number) => seen.push(zoom) } as never);

    post({ type: FOCUSED, count: 1, mode: 'mount', dark: true });
    post({ type: 'feega:focus-zoomed', zoom: 2 });

    expect(seen).toEqual([[1, 'mount', undefined, undefined, true], 2]);
  });

  it('hands over what the mounted component reports', () => {
    const post = pageWindow();
    const seen: unknown[] = [];
    pageBridge(() => null, { mounted: (status: unknown) => seen.push(status) } as never);

    post({ type: 'feega:mount:status', status: 'ready', controls: [{ name: 'size', kind: 'select' }], props: { size: 'sm' } });

    expect(seen).toEqual([{ status: 'ready', reason: undefined, controls: [{ name: 'size', kind: 'select' }], props: { size: 'sm' } }]);
  });

  it('sends props and variants to the focus tab only', () => {
    const posted: unknown[] = [];
    pageWindow();
    const bridge = pageBridge(() => ({ src: `${ORIGIN}/`, contentWindow: { postMessage: (m: unknown) => posted.push(m) } }) as unknown as HTMLIFrameElement, {} as never);

    bridge.mountProps({ size: 'lg' }, null);

    expect(posted).toEqual([{ type: 'feega:mount:props', props: { size: 'lg' }, variants: null, focus: true }]);
  });
});
