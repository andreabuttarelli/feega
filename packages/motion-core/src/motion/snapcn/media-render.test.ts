// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { snapcnKit } from './kit';
import { snapcnPort } from './catalog';
import { propsOf } from './model';

const S = snapcnKit();

const defaultsOf = (port: NonNullable<ReturnType<typeof snapcnPort>>) => Object.fromEntries(Object.entries(propsOf(port)).map(([key, spec]) => [key, spec.default]));
const LOGO = 'https://assets.test/logo.png';
const RING = ['https://assets.test/a.png', 'https://assets.test/b.png'];

describe('snapcn ports draw the media the pickers resolve', () => {
  it('logo-assemble shows the picked logo and ring images', () => {
    const port = snapcnPort('logo-assemble')!;
    const root = document.createElement('div');
    const props = { ...defaultsOf(port), logoSrc: LOGO, images: RING.map((src) => ({ src, kind: 'image' })) };
    const clean = Object.fromEntries(Object.entries(props).map(([key, value]) => [key, value ?? '']));
    const render = port.draw(S, { root, width: port.width, height: port.height, fps: port.fps, frames: port.frames, props: clean });
    render(port.frames - 1);

    const sources = [...root.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(sources).toContain(LOGO);
    expect(sources).toEqual(expect.arrayContaining(RING));
  });

  it('logo-assemble shows the feega mark when no logo is picked', () => {
    const port = snapcnPort('logo-assemble')!;
    const root = document.createElement('div');
    const clean = Object.fromEntries(Object.entries(defaultsOf(port)).map(([key, value]) => [key, value ?? '']));
    port.draw(S, { root, width: port.width, height: port.height, fps: port.fps, frames: port.frames, props: clean })(0);

    expect([...root.querySelectorAll('img')].map((img) => img.getAttribute('src'))).toEqual([S.markSrc]);
    expect(root.children.length).toBeGreaterThan(0);
  });
});
