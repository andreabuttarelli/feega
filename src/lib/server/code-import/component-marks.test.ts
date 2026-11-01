// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { componentMarksOf, MARK_LIMITS } from './component-marks';

const ATTR = 'data-feega-use';
const HOST = 5;
const FUNCTION = 0;

type Fiber = { tag: number; type: unknown; memoizedProps: Record<string, unknown> | null; return: Fiber | null; alternate: Fiber | null; _debugInfo?: unknown[] };

const named = (name: string) => Object.defineProperty(() => null, 'name', { value: name });

const composite = (name: string, props: Record<string, unknown>, parent: Fiber | null): Fiber => ({ tag: FUNCTION, type: named(name), memoizedProps: props, return: parent, alternate: null });

function hostOf(tag: string, parent: Fiber | null, into: Element, debugInfo?: unknown[]): { el: Element; fiber: Fiber } {
  const el = document.createElement(tag);
  const fiber: Fiber = { tag: HOST, type: tag, memoizedProps: {}, return: parent, alternate: null, ...(debugInfo ? { _debugInfo: debugInfo } : {}) };
  Object.assign(el, { __reactFiber$t: fiber });
  into.appendChild(el);
  return { el, fiber };
}

const marks = (names: string[]) => componentMarksOf({ names, limits: MARK_LIMITS, attr: ATTR });

afterEach(() => {
  document.body.innerHTML = '';
});

describe('componentMarksOf con React', () => {
  it('due componenti con lo stesso elemento radice restano entrambi, l\'interno dentro l\'esterno', () => {
    const page = hostOf('main', null, document.body);
    const outer = composite('Card', { tone: 'muted' }, page.fiber);
    const inner = composite('Panel', { children: 'Hi' }, outer);
    const { el } = hostOf('div', inner, page.el);

    const uses = marks(['Card', 'Panel']);

    expect(uses).toEqual([
      { component: 'Card', props: { tone: 'muted' } },
      { component: 'Panel', props: { children: 'Hi' }, shares: 0 }
    ]);
    expect(el.getAttribute(ATTR)).toBe('0');
  });

  it('un componente con due elementi radice non è un uso', () => {
    const page = hostOf('main', null, document.body);
    const list = composite('Pair', {}, page.fiber);
    hostOf('div', list, page.el);
    hostOf('div', list, page.el);

    expect(marks(['Pair'])).toEqual([]);
  });

  it('un nome che il repo non dichiara resta un livello, uno annotato da docgen no', () => {
    const page = hostOf('main', null, document.body);
    const library = composite('Slot', {}, page.fiber);
    const documented = composite('x', { size: 'sm' }, page.fiber);
    Object.assign(documented.type as object, { __docgenInfo: { displayName: 'Badge' } });
    hostOf('span', library, page.el);
    hostOf('span', documented, page.el);

    expect(marks([])).toEqual([{ component: 'Badge', props: { size: 'sm' } }]);
  });

  it('un displayName con lo spazio dei nomi della libreria vale per il suo ultimo segmento', () => {
    const page = hostOf('main', null, document.body);
    const button = { tag: 11, type: { displayName: 'HeroUI.Button', render: named('v') }, memoizedProps: { color: 'primary' }, return: page.fiber, alternate: null };
    hostOf('button', button, page.el);

    expect(marks(['Button'])).toEqual([{ component: 'Button', props: { color: 'primary' } }]);
  });

  it('body e html di React 19 (HostSingleton) chiudono il segmento come un div', () => {
    const layout = composite('RootLayout', {}, null);
    const body = { tag: 27, type: 'body', memoizedProps: {}, return: layout, alternate: null };
    Object.assign(document.body, { __reactFiber$t: body });
    hostOf('div', body, document.body);

    expect(marks(['RootLayout'])).toEqual([]);
  });

  it('un server component si legge da _debugInfo, con le sue props', () => {
    const page = hostOf('main', null, document.body);
    const info = { name: 'PostCard', env: 'Server', props: { featured: true, title: 'Hello' } };
    const { el } = hostOf('article', page.fiber, page.el, [info]);

    expect(marks(['PostCard'])).toEqual([{ component: 'PostCard', props: { featured: true, title: 'Hello' } }]);
    expect(el.getAttribute(ATTR)).toBe('0');
  });

  it('un server component che avvolge un client component sta fuori, il client dentro', () => {
    const page = hostOf('main', null, document.body);
    const client = composite('LikeButton', {}, page.fiber);
    client._debugInfo = [{ name: 'Post', env: 'Server' }];
    hostOf('button', client, page.el);

    expect(marks(['Post', 'LikeButton']).map((u) => [u.component, u.shares])).toEqual([
      ['Post', undefined],
      ['LikeButton', 0]
    ]);
  });
});

describe('componentMarksOf con Vue', () => {
  const instance = (name: string, file: string, props: Record<string, unknown>, parent: object | null) => ({ type: { __name: name, __file: file }, props, parent, subTree: { el: null as Element | null } });

  it('l\'istanza la cui radice è l\'elemento è un uso, con le props dichiarate', () => {
    const app = instance('App', '/src/App.vue', {}, null);
    const button = instance('BaseButton', '/src/components/BaseButton.vue', { variant: 'primary', label: 'Save' }, app);
    const el = document.createElement('button');
    Object.assign(el, { __vueParentComponent: button });
    button.subTree.el = el;
    document.body.appendChild(el);

    expect(marks([])).toEqual([{ component: 'BaseButton', props: { variant: 'primary', label: 'Save' } }]);
  });

  it('un componente di node_modules non è del codice', () => {
    const lib = instance('RouterLink', '/app/node_modules/vue-router/RouterLink.vue', {}, null);
    const el = document.createElement('a');
    Object.assign(el, { __vueParentComponent: lib });
    lib.subTree.el = el;
    document.body.appendChild(el);

    expect(marks([])).toEqual([]);
  });
});

describe('componentMarksOf con Svelte', () => {
  it('il tag del componente nomina l\'uso; un wrapper attorno a un altro componente lo contiene', () => {
    const page = { type: 'component', file: 'src/routes/+page.svelte', componentTag: 'Card', parent: null };
    const inner = { type: 'component', file: 'src/lib/Card.svelte', componentTag: 'Surface', parent: page };
    const main = document.createElement('main');
    Object.assign(main, { __svelte_meta: { parent: null, loc: { file: 'src/routes/+page.svelte', line: 1, column: 0 } } });
    const el = document.createElement('div');
    Object.assign(el, { __svelte_meta: { parent: inner, loc: { file: 'src/lib/Surface.svelte', line: 1, column: 0 } } });
    main.appendChild(el);
    document.body.appendChild(main);

    expect(marks([])).toEqual([
      { component: 'Card', props: {} },
      { component: 'Surface', props: {}, shares: 0 }
    ]);
  });

  it('un componente definito in node_modules non è del codice', () => {
    const page = { type: 'component', file: 'src/routes/+page.svelte', componentTag: 'Dialog', parent: null };
    const el = document.createElement('div');
    Object.assign(el, { __svelte_meta: { parent: page, loc: { file: 'node_modules/bits-ui/dialog.svelte', line: 1, column: 0 } } });
    document.body.appendChild(el);

    expect(marks([])).toEqual([]);
  });
});
