import { describe, expect, it } from 'vitest';
import type { Focus } from './focus';
import { readAskOf, withUsage } from './usage-values';

const focus = (file: string, usage: Focus['usage'] = { at: { file: 'src/Page.svelte', line: 5, col: 1 }, which: { index: 0, count: 2 } }): Focus => ({ name: 'Card', source: { file, line: 1, col: 1 }, index: 0, usage });

describe('readAskOf', () => {
  it.each(['src/Card.svelte', 'src/Card.astro'])('asks for the props passed to %s', (file) => {
    expect(readAskOf(focus(file))).toEqual({ component: file, usage: 'src/Page.svelte:5:1', which: { index: 0, count: 2 } });
  });

  it.each(['src/Card.tsx', 'src/Card.vue'])('does not ask for %s, which has its real props already', (file) => {
    expect(readAskOf(focus(file))).toBeNull();
  });

  it('does not ask without a usage', () => {
    expect(readAskOf(focus('src/Card.svelte', null))).toBeNull();
  });
});

describe('withUsage', () => {
  const mount = { controls: [{ name: 'title' }, { name: 'size' }, { name: 'tone' }], values: { title: 'title', size: 0, tone: 'a' }, touched: ['tone'], dynamic: [] as string[] };

  it('puts the literals of the usage over the defaults', () => {
    expect(withUsage(mount as never, { values: { title: 'Hi' }, dynamic: [] }).values).toEqual({ title: 'Hi', size: 0, tone: 'a' });
  });

  it('keeps the default of a dynamic prop and marks it', () => {
    const merged = withUsage(mount as never, { values: {}, dynamic: ['size', 'other'] });

    expect(merged.values.size).toBe(0);
    expect(merged.dynamic).toEqual(['size']);
  });

  it('does not override what the user already edited', () => {
    expect(withUsage(mount as never, { values: { tone: 'b' }, dynamic: [] }).values.tone).toBe('a');
  });
});
