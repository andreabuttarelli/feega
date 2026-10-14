import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { crewBrief, crewTools } from './turn';

const crew = { acts: ['problem', 'solution'], from: 0, to: 10 };

const placing = () => ({ execute: vi.fn(async () => ({ ok: true })) }) as unknown as Tool;

describe('a shot crew', () => {
  it.each(['add_shot', 'add_template'])('%s outside the crew range is refused, inside it runs', async (name) => {
    const tool = placing();
    const guarded = crewTools({ [name]: tool }, crew)[name];
    const run = (at: number) => guarded.execute!({ at }, { toolCallId: 'c', messages: [] } as never);

    expect(await run(12)).toMatchObject({ ok: false, error: expect.stringMatching(/outside your range/) });
    expect(await run(4)).toEqual({ ok: true });
  });

  it('is briefed to fill its sections from library templates first', () => {
    expect(crewBrief(crew)).toMatch(/list_templates/);
  });
});
