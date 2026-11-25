import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const style = readFileSync(new URL('./BreakpointBar.svelte', import.meta.url), 'utf8');

describe('breakpoint trigger', () => {
  it('wears the input background like the other dropdowns', () => {
    const rule = style.match(/\.reach-row :global\(\.select\) \{([^}]*)\}/)?.[1] ?? '';

    expect(rule).toContain('background: var(--ui-input)');
  });
});
