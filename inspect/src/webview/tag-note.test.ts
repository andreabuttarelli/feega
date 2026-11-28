import { describe, expect, it } from 'vitest';
import type { Pick } from '../messages';
import { tagNote } from './tag-note';

const at = { file: 'src/lib/Card.svelte', line: 3, col: 5 };
const pick = (over: Partial<Pick>) => ({ source: at, component: null, instances: 1, ...over }) as Pick;

describe('tagNote', () => {
  it('names the component and its uses when it is used more than once', () => {
    expect(tagNote(pick({ component: { file: 'src/Page.svelte', line: 9, col: 3 }, instances: 3 }))).toBe('Changes all 3 uses of <Card>');
  });

  it('says nothing for a single use or an element outside a component', () => {
    expect(tagNote(pick({ component: { file: 'src/Page.svelte', line: 9, col: 3 }, instances: 1 }))).toBeNull();
    expect(tagNote(pick({ component: null, instances: 3 }))).toBeNull();
  });
});
