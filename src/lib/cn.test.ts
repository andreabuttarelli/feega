import { describe, expect, it } from 'vitest';
import { cn } from './utils';
import { SECTION_LABEL } from './components/ui/shell/styles';

describe('cn knows the shell type roles are sizes, not colours', () => {
  it('a type role and a text colour both survive the merge', () => {
    expect(cn('text-ui-section', 'text-ui-text-3').split(' ')).toEqual(['text-ui-section', 'text-ui-text-3']);
  });

  it('a section label keeps its size next to its colour', () => {
    expect(cn('truncate', SECTION_LABEL)).toContain('text-ui-section');
  });

  it('two type roles still collapse to the last one', () => {
    expect(cn('text-ui-label', 'text-ui-body')).toBe('text-ui-body');
  });
});
