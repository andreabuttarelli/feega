import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MIN_FIELD_PX = 60;
const style = readFileSync(new URL('./Properties.svelte', import.meta.url), 'utf8');

const ruleOf = (selector: string) => style.match(new RegExp(`\\n  ${selector.replace('.', '\\.')} \\{([^}]*)\\}`))?.[1] ?? '';

describe('typography size row', () => {
  it('wraps its fields before any of them shrinks below a usable width', () => {
    const columns = ruleOf('.triple').match(/grid-template-columns:\s*(.+);/)?.[1] ?? '';

    const floor = Number(columns.match(/repeat\(auto-fit,\s*minmax\((\d+)px,\s*1fr\)\)/)?.[1]);

    expect(floor).toBeGreaterThanOrEqual(MIN_FIELD_PX);
  });
});
