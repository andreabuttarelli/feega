import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const panel = readFileSync(new URL('./HistoryPanel.svelte', import.meta.url), 'utf8');

describe('HistoryPanel styles', () => {
  it('a conflict row is not restyled as a column by the revert choice block', () => {
    const bareConflictRule = /^\s*\.conflict\s*\{/m;

    expect(bareConflictRule.test(panel)).toBe(false);
  });
});
