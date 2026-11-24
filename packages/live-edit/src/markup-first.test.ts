import { describe, expect, it } from 'vitest';
import { markupFirst } from './markup-first';

const BEFORE = '<h3>A</h3>\n\n<style>\n  h3 { color: red; }\n</style>\n';
const BOTH = '<h3 class="a">A</h3>\n\n<style>\n  h3 { color: red; }\n  .a { color: blue; }\n</style>\n';

describe('markupFirst', () => {
  it('keeps the old style while the markup changes', () => {
    expect(markupFirst(BEFORE, BOTH)).toBe('<h3 class="a">A</h3>\n\n<style>\n  h3 { color: red; }\n</style>\n');
  });

  it('is null when only the style changes', () => {
    expect(markupFirst(BEFORE, BEFORE.replace('red', 'blue'))).toBeNull();
  });

  it('is null when only the markup changes', () => {
    expect(markupFirst(BEFORE, BEFORE.replace('<h3>', '<h3 class="a">'))).toBeNull();
  });

  it('is null when the file had no style block', () => {
    expect(markupFirst('<h3>A</h3>\n', BOTH)).toBeNull();
  });
});
