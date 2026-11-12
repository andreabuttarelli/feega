import { describe, expect, it } from 'vitest';
import { customComponentSchema, MAX_JS, MAX_PROPS, PropFormat } from '../custom/component';
import { snapcnComponent, snapcnSource } from '../snapcn/model';
import { RENDERCOMP_PORTS } from './catalog';

const ISOLATED_GLOBALS = ['root', 'props', 'tl', 'duration', 'fps'];
const PORTS = RENDERCOMP_PORTS.map((p) => [p.id, p] as const);
const THIRD_PARTY = /render\s*comp|trimora|remotion/i;
const MEDIA_FORMATS = new Set<string | undefined>([PropFormat.Asset, PropFormat.Media]);

describe('rendercomp catalog', () => {
  it('lists every port once', () => {
    const ids = RENDERCOMP_PORTS.map((p) => p.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(PORTS)('%s is a valid deterministic custom component', (_, port) => {
    const component = snapcnComponent(port);
    expect(customComponentSchema.safeParse(component).success).toBe(true);
    expect(component.source.js.length).toBeLessThan(MAX_JS);
    expect(Object.keys(component.propsSchema.properties).length).toBeLessThanOrEqual(MAX_PROPS);
  });

  it.each(PORTS)('%s source compiles with no reference outside its own scope', (_, port) => {
    expect(() => new Function(...ISOLATED_GLOBALS, snapcnSource(port))).not.toThrow();
    expect(snapcnSource(port)).not.toMatch(/__vite_ssr_import|__name\(|import\(/);
  });

  it('every media prop is an asset or media picker with an empty default', () => {
    const bad = RENDERCOMP_PORTS.flatMap((port) =>
      Object.entries(port.props)
        .filter(([, spec]) => MEDIA_FORMATS.has(spec.format))
        .filter(([, spec]) => (spec.format === PropFormat.Asset ? spec.default !== null : spec.default !== ''))
        .map(([key]) => `${port.id}.${key}`)
    );
    expect(bad).toEqual([]);
  });

  it('shows feega, never the upstream brand, in what a template draws or lists', () => {
    const shown = RENDERCOMP_PORTS.filter((port) => [port.title, port.about, ...Object.values(port.props).map((spec) => String(spec.default ?? '')), port.draw.toString()].some((text) => THIRD_PARTY.test(text))).map((p) => p.id);
    expect(shown).toEqual([]);
  });
});
