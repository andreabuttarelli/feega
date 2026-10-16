import { describe, expect, it, vi } from 'vitest';
import { creditsForRun } from '$lib/canvas/gen-cost';
import { billedCreditsFor } from '$lib/credit-ladder';
import { ProjectMode } from '$lib/project-mode';
import { higgsfieldModelRows, HIGGSFIELD_MODELS, type HiggsfieldModel } from './higgsfield-catalogue';
import { taskChoice } from './task-choice';
import { finishTaskJob, type TaskModel } from './canvas/task-run';
import { HF_VIDEO_DONE } from './higgsfield.fixtures';

const SYNCED = '2026-10-15T00:00:00.000Z';
const USD_BY_DURATION: Record<string, number> = { '5': 0.21, '10': 0.42, '6': 0.28 };

const estimate = vi.fn(async (_path: string, inputs: Record<string, unknown>) => USD_BY_DURATION[String(inputs.duration)] ?? 0.094);

describe('the Higgsfield catalogue', () => {
  it('prices every model from /estimate and offers it only when every variant has a price', async () => {
    const { rows } = await higgsfieldModelRows(estimate, SYNCED);
    expect(rows).toHaveLength(HIGGSFIELD_MODELS.length);

    const { rows: partial } = await higgsfieldModelRows(async (path, inputs) => (path.includes('hailuo') && inputs.duration === 10 ? null : 0.1), SYNCED);
    expect(partial.map((r) => r.id).some((id) => id.includes('hailuo'))).toBe(false);
  });

  it('the picker price of Kling 2.5 Turbo at 10 s equals what the finished task charges', async () => {
    const { rows } = await higgsfieldModelRows(estimate, SYNCED);
    const row = rows.find((r) => r.id === 'higgsfield/kling-video/v2.5-turbo/pro/text-to-video')!;
    const choice = taskChoice(row);
    const shown = creditsForRun({ medium: 'video', model: choice, params: { duration: 10 } });

    const bill = vi.fn();
    const model: TaskModel = { id: row.id, catalogue: 'video', spec: row.wire_spec as TaskModel['spec'], uncensored: false, paramSchema: row.param_schema, pricing: row.pricing };
    const providers = { higgsfield: { run: vi.fn(), task: vi.fn().mockResolvedValue({ state: 'done', outputs: [{ url: HF_VIDEO_DONE.video.url, contentType: 'video/mp4' }], costUsd: null }) } };
    const db = { storage: { from: () => ({ upload: async () => ({ error: null }) }) }, from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'a1' }, error: null }) }) }) }) };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([0, 0, 0, 24]), { headers: { 'content-type': 'video/mp4' } })));

    await finishTaskJob(db as never, { providers, model: async () => model, bill }, {
      externalJobId: 'higgsfield:req-1',
      modelId: row.id,
      scope: { orgId: 'o', projectId: 'p', nodeId: 'n', userId: 'u' },
      mode: ProjectMode.Standard,
      params: { duration: 10 }
    });

    expect(bill).toHaveBeenCalledWith(expect.objectContaining({ provider: 'higgsfield', costUsd: 0.42, quotedUsd: 0.42 }));
    expect(shown).toBe(billedCreditsFor(0.42));
  });

  it('labels every model under Higgsfield and never as uncensored', async () => {
    const { rows } = await higgsfieldModelRows(estimate, SYNCED);
    const choices = rows.map(taskChoice);
    expect(choices.every((c) => c.providerLabel === 'Higgsfield' && c.uncensored === false)).toBe(true);
  });

  it('prices every duration × resolution pair, and the run is quoted on its own pair', async () => {
    const both: HiggsfieldModel = {
      path: 'bytedance/seedance-2.5/text-to-video',
      label: 'Seedance 2.5',
      catalogue: 'video',
      fields: { prompt: 'prompt', duration: 'duration', resolution: 'resolution', images: [] },
      numeric: ['duration'],
      priceBy: [
        { key: 'duration', values: [5, 10] },
        { key: 'resolution', values: ['720p', '1080p'] }
      ],
      schema: { duration: [5, 10], resolution: ['720p', '1080p'] },
      estimateBase: { prompt: 'price estimate' }
    };
    const usd = (inputs: Record<string, unknown>) => Number(inputs.duration) * (inputs.resolution === '1080p' ? 0.2 : 0.1);

    const { rows } = await higgsfieldModelRows(async (_path, inputs) => usd(inputs), SYNCED, [both]);

    expect((rows[0].pricing as { lines: unknown[] }).lines).toEqual([
      { inputs: { duration: '5', resolution: '720p' }, usd: 0.5, method: 'cpr' },
      { inputs: { duration: '5', resolution: '1080p' }, usd: 1, method: 'cpr' },
      { inputs: { duration: '10', resolution: '720p' }, usd: 1, method: 'cpr' },
      { inputs: { duration: '10', resolution: '1080p' }, usd: 2, method: 'cpr' }
    ]);
    expect(rows[0].supported_resolutions).toEqual(['720p', '1080p']);
    const shown = creditsForRun({ medium: 'video', model: taskChoice(rows[0]), params: { duration: 10, resolution: '1080p' } });
    expect(shown).toBe(billedCreditsFor(2));
  });

  it('offers Soul only the resolutions and aspect ratios its schema accepts', async () => {
    const { rows } = await higgsfieldModelRows(estimate, SYNCED);
    const soul = rows.find((r) => r.id === 'higgsfield/higgsfield-ai/soul/standard')!;
    expect(soul.supported_resolutions).toEqual(['720p', '1080p']);
    expect(soul.param_schema).toEqual({ aspect_ratio: { type: 'enum', values: ['9:16', '16:9', '4:3', '3:4', '1:1', '2:3', '3:2'] } });
  });
});

