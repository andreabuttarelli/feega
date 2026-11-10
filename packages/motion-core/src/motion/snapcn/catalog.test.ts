import { describe, expect, it } from 'vitest';
import { customComponentSchema, MAX_JS, MAX_PROPS } from '../custom/component';
import { SNAPCN_PORTS } from './catalog';
import { snapcnComponent, snapcnSource } from './model';

const ISOLATED_GLOBALS = ['root', 'props', 'tl', 'duration', 'fps'];

describe('snapcn catalog', () => {
  it('ports every free snapcn component it lists, once', () => {
    const ids = SNAPCN_PORTS.map((p) => p.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(SNAPCN_PORTS.map((p) => [p.id, p]))('%s is a valid deterministic custom component', (_, port) => {
    const component = snapcnComponent(port);
    expect(customComponentSchema.safeParse(component).success).toBe(true);
    expect(component.source.js.length).toBeLessThan(MAX_JS);
    expect(Object.keys(component.propsSchema.properties).length).toBeLessThanOrEqual(MAX_PROPS);
  });

  it.each(SNAPCN_PORTS.map((p) => [p.id, p]))('%s source compiles with no reference outside its own scope', (_, port) => {
    expect(() => new Function(...ISOLATED_GLOBALS, snapcnSource(port))).not.toThrow();
    expect(snapcnSource(port)).not.toMatch(/__vite_ssr_import|__name\(|import\(/);
  });
});
