import { describe, expect, it } from 'vitest';
import { customComponentSchema, MAX_JS, MAX_PROPS } from '../custom/component';
import { snapcnComponent, snapcnSource } from '../snapcn/model';
import { UI_LOOP_PORTS } from './catalog';

const ISOLATED_GLOBALS = ['root', 'props', 'tl', 'duration', 'fps'];
const SOURCES = ['magicui', 'animata', 'lucide'];

describe('ui loops catalog', () => {
  it('lists every ported loop once, under a licensed source', () => {
    const ids = UI_LOOP_PORTS.map((p) => p.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !SOURCES.some((s) => id.startsWith(`${s}-`)))).toEqual([]);
  });

  it.each(UI_LOOP_PORTS.map((p) => [p.id, p]))('%s is a valid deterministic custom component', (_, port) => {
    const component = snapcnComponent(port);
    expect(customComponentSchema.safeParse(component).success).toBe(true);
    expect(component.source.js.length).toBeLessThan(MAX_JS);
    expect(Object.keys(component.propsSchema.properties).length).toBeLessThanOrEqual(MAX_PROPS);
  });

  it.each(UI_LOOP_PORTS.map((p) => [p.id, p]))('%s source compiles with no reference outside its own scope', (_, port) => {
    expect(() => new Function(...ISOLATED_GLOBALS, snapcnSource(port))).not.toThrow();
    expect(snapcnSource(port)).not.toMatch(/__vite_ssr_import|__name\(|import\(/);
  });
});
