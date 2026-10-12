import { describe, expect, it } from 'vitest';
import { CONTINUE_MESSAGE, VIDEO_BUDGET, pendingBudget } from './budget-card';

const card = { ok: true, spent_usd: 2.04, cap_usd: 2, raise_usd: 1 };
const tool = { toolName: VIDEO_BUDGET, output: card };

describe('the continue card of a video that spent its budget', () => {
  it('shows only on the last finished answer', () => {
    expect(pendingBudget([{ role: 'assistant', content: '', tools: [tool] }])).toEqual(card);
    expect(pendingBudget([{ role: 'assistant', content: '', tools: [tool] }, { role: 'user', content: CONTINUE_MESSAGE }])).toBeNull();
    expect(pendingBudget([{ role: 'assistant', content: '', tools: [tool], live: true }])).toBeNull();
    expect(pendingBudget([{ role: 'assistant', content: '', tools: [{ toolName: 'add_clip', output: {} }] }])).toBeNull();
  });
});
