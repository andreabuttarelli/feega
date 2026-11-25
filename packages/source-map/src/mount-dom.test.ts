import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { startDomMount, svelteMount, vueMount } from './mount-dom.js';

function setup() {
  const win = new JSDOM('<!doctype html><body><div id="root"></div></body>', { pretendToBeVisual: true }).window;
  const posted: Record<string, unknown>[] = [];
  Object.defineProperty(win, 'parent', { value: { postMessage: (data: Record<string, unknown>) => posted.push(data) } });
  const drawn: { html: string; props: unknown }[] = [];
  const unmounted: string[] = [];
  const mountInto = (host: Element, props: Record<string, unknown>) => {
    host.innerHTML = `<b>${props.label}</b>`;
    drawn.push({ html: host.parentElement!.outerHTML, props });
    return () => unmounted.push(String(props.label));
  };
  const fetched = { json: async () => ({ controls: [{ name: 'label' }] }) };
  const start = () => startDomMount({ mountInto, mod: { default: () => null }, name: 'Card', file: 'src/Card.vue', props: { label: 'Hi', onClick: { $fn: true } }, controlsUrl: '/props', win: Object.assign(win, { fetch: async () => fetched }) as unknown as Window });
  const send = (data: Record<string, unknown>) => win.dispatchEvent(new win.MessageEvent('message', { data }));
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  return { win, posted, drawn, unmounted, start, send, wait };
}

describe('startDomMount', () => {
  it('draws the component with the props it was given, functions revived', () => {
    const { start, drawn } = setup();
    start();

    expect(drawn).toHaveLength(1);
    expect((drawn[0].props as { onClick: () => unknown }).onClick()).toBeUndefined();
  });

  it('reports ready with controls and props once something is on screen', async () => {
    const { start, posted, wait } = setup();
    start();
    await wait(450);

    expect(posted).toContainEqual(expect.objectContaining({ type: 'feega:mount:status', status: 'ready', controls: [{ name: 'label' }] }));
  });

  it('unmounts and draws again with new props, and one cell for each variant', () => {
    const { start, send, win, unmounted } = setup();
    start();
    send({ type: 'feega:mount:props', props: { label: 'x' }, variants: [{ label: 'a', props: { label: 'A' } }, { label: 'b', props: { label: 'B' } }] });

    expect(unmounted).toEqual(['Hi']);
    expect([...win.document.querySelectorAll('[data-feega-variant]')].map((cell) => cell.getAttribute('data-feega-variant'))).toEqual(['a', 'b']);
  });

  it('fails at once when the file has no default export', () => {
    const { posted, win } = setup();
    startDomMount({ mountInto: () => () => undefined, mod: {}, name: 'Card', file: 'x.vue', props: {}, controlsUrl: '/p', win: win as unknown as Window });

    expect(posted).toEqual([{ type: 'feega:mount:status', status: 'failed', reason: 'The component is not exported' }]);
  });

  it('says so when mounting throws', () => {
    const { posted, win } = setup();
    startDomMount({ mountInto: () => { throw new Error('boom'); }, mod: { default: 1 }, name: 'Card', file: 'x.vue', props: {}, controlsUrl: '/p', win: win as unknown as Window });

    expect(posted).toContainEqual({ type: 'feega:mount:status', status: 'failed', reason: 'boom' });
  });
});

describe('the framework mounters', () => {
  it('mounts a Vue app on the host and unmounts it', () => {
    const calls: string[] = [];
    const app = { config: {} as Record<string, unknown>, mount: () => calls.push('mount'), unmount: () => calls.push('unmount') };
    const lib = { createApp: () => app, h: () => null };

    vueMount(lib, {})(null as unknown as Element, {}, () => undefined)();

    expect(calls).toEqual(['mount', 'unmount']);
  });

  it('mounts a Svelte component into the host and unmounts it', () => {
    const calls: string[] = [];
    const lib = { mount: (_c: unknown, o: { props: unknown }) => (calls.push(JSON.stringify(o.props)), 'instance'), unmount: (i: string) => calls.push(i) };

    svelteMount(lib, {})(null as unknown as Element, { a: 1 })();

    expect(calls).toEqual(['{"a":1}', 'instance']);
  });
});
