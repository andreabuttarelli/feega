import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const SOURCE = 'static/embed/liquid-glass.js';

function load() {
  const defined = new Map<string, unknown>();
  const context = {
    HTMLElement: class {},
    customElements: { define: (name: string, cls: unknown) => defined.set(name, cls), get: (name: string) => defined.get(name) },
    document: { head: { appendChild: () => {} }, createElement: () => ({}), fonts: { ready: Promise.resolve() } },
    matchMedia: () => ({ matches: false })
  };
  runInNewContext(readFileSync(SOURCE, 'utf8'), context);
  return defined;
}

describe('embed liquid glass', () => {
  it('registra il tag che il sito incolla', () => {
    expect(load().has('feega-liquid-glass')).toBe(true);
  });

  it('caricato due volte non ridefinisce il tag', () => {
    const defined = new Map<string, unknown>();
    const context = {
      HTMLElement: class {},
      customElements: {
        define: (name: string, cls: unknown) => {
          if (defined.has(name)) {
            throw new Error('already defined');
          }
          defined.set(name, cls);
        },
        get: (name: string) => defined.get(name)
      },
      document: { head: { appendChild: () => {} }, createElement: () => ({}), fonts: { ready: Promise.resolve() } },
      matchMedia: () => ({ matches: false })
    };
    const code = readFileSync(SOURCE, 'utf8');
    runInNewContext(code, context);

    expect(() => runInNewContext(code, context)).not.toThrow();
  });
});
