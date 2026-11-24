import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { reactMountOf } from './framework-meta.js';

const FUNCTION = 0;
const MEMO = 15;
const HOST = 5;
const CONTEXT = 10;

type Fiber = { tag: number; type?: unknown; memoizedProps: Record<string, unknown>; return: Fiber | null };

function element(fiber: Fiber | null) {
  const win = new JSDOM('<div></div>').window;
  const node = win.document.querySelector('div') as unknown as Record<string, unknown>;
  if (fiber) {
    node['__reactFiber$x1'] = fiber;
  }
  return node as unknown as Element;
}

function Card() {}
const component = (props: Record<string, unknown>, type: unknown = Card, tag = FUNCTION): Fiber => ({ tag, type, memoizedProps: props, return: null });
const host = (parent: Fiber): Fiber => ({ tag: HOST, type: 'article', memoizedProps: {}, return: parent });

describe('reactMountOf', () => {
  it('reads the name and props of the component that renders the element', () => {
    const fiber = host(component({ size: 'sm', disabled: true, count: 2 }));

    expect(reactMountOf(element(fiber))).toEqual({ name: 'Card', props: { size: 'sm', disabled: true, count: 2 } });
  });

  it('skips the providers and hosts between the element and its component', () => {
    const inner = host({ tag: CONTEXT, memoizedProps: {}, return: component({ a: 1 }) });

    expect(reactMountOf(element(inner))!.props).toEqual({ a: 1 });
  });

  it('marks functions so the mount can swap them for no-ops', () => {
    const fiber = host(component({ onClick: () => undefined }));

    expect(reactMountOf(element(fiber))!.props).toEqual({ onClick: { $fn: true } });
  });

  it('keeps text children and drops React elements', () => {
    const text = host(component({ children: 'Buy' }));
    const nodes = host(component({ children: { $$typeof: Symbol.for('react.transitional.element'), type: 'b' } }));

    expect(reactMountOf(element(text))!.props).toEqual({ children: 'Buy' });
    expect(reactMountOf(element(nodes))!.props).toEqual({});
  });

  it('keeps plain objects and arrays and drops what is not data', () => {
    class Client {}
    const fiber = host(component({ items: [1, 'a', { b: true }], theme: { color: 'red' }, client: new Client(), node: element(null), sym: Symbol('s'), nothing: undefined }));

    expect(reactMountOf(element(fiber))!.props).toEqual({ items: [1, 'a', { b: true }], theme: { color: 'red' } });
  });

  it('gives up on a value nested too deep or cyclic', () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;

    expect(reactMountOf(element(host(component({ loop }))))!.props).toEqual({});
  });

  it('names a memo component after the function it wraps', () => {
    const fiber = host(component({ a: 1 }, function Badge() {}, MEMO));

    expect(reactMountOf(element(fiber))!.name).toBe('Badge');
  });

  it('names a wrapped component through displayName', () => {
    const wrapped = { $$typeof: Symbol.for('react.forward_ref'), displayName: 'Field', render: () => null };

    expect(reactMountOf(element(host(component({}, wrapped, 11))))!.name).toBe('Field');
  });

  it('returns null for an element React did not render', () => {
    expect(reactMountOf(element(null))).toBeNull();
  });

  it('returns null when no component sits above the element', () => {
    expect(reactMountOf(element({ tag: HOST, type: 'div', memoizedProps: {}, return: null }))).toBeNull();
  });
});
