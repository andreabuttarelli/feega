import { describe, expect, it } from 'vitest';
import { usageBreakdown, UsageKind } from './usage-breakdown';

const call = (extra: Record<string, unknown>) => ({ operation: 'chat', actor_kind: 'user', project_id: null, billed_credits: 10, cost_usd: null, ...extra });

describe('usageBreakdown', () => {
  it('sums credits per project, the biggest first, unnamed calls under no project', () => {
    const usage = usageBreakdown(
      [call({ project_id: 'p1', billed_credits: 5 }), call({ project_id: 'p2', billed_credits: 30 }), call({ project_id: 'p1', billed_credits: 5 }), call({})],
      [{ id: 'p1', name: 'Launch' }, { id: 'p2', name: 'Ads' }]
    );

    expect(usage.total).toBe(50);
    expect(usage.byProject).toEqual([
      { id: 'p2', name: 'Ads', credits: 30 },
      { id: 'p1', name: 'Launch', credits: 10 },
      { id: null, name: null, credits: 10 }
    ]);
  });

  it('sorts calls into image, video, audio, agent and chat', () => {
    const usage = usageBreakdown(
      [
        call({ operation: 'renderImage:tool:x', billed_credits: 8 }),
        call({ operation: 'video', billed_credits: 40 }),
        call({ operation: 'music', billed_credits: 6 }),
        call({ operation: 'project-agent', actor_kind: 'agent', billed_credits: 3 }),
        call({ operation: 'chat', billed_credits: 2 })
      ],
      []
    );

    expect(usage.byKind.map((k) => [k.kind, k.credits, k.calls])).toEqual([
      [UsageKind.Video, 40, 1],
      [UsageKind.Image, 8, 1],
      [UsageKind.Audio, 6, 1],
      [UsageKind.Agent, 3, 1],
      [UsageKind.Chat, 2, 1]
    ]);
  });

  it('prices a call without billed credits from its cost', () => {
    expect(usageBreakdown([call({ billed_credits: null, cost_usd: 1 })], []).total).toBe(120);
  });

  it('leaves out kinds and projects that spent nothing', () => {
    expect(usageBreakdown([call({ billed_credits: 0 })], [])).toEqual({ total: 0, byProject: [], byKind: [] });
  });
});
