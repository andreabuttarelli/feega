import { describe, expect, it, vi } from 'vitest';

const gate = vi.fn(async () => undefined as unknown);
vi.mock('$lib/server/cli-auth', async (original) => ({ ...(await original<object>()), gateOrgAiActionForForm: gate }));
vi.mock('./studio-options', () => ({ studioOptions: async () => ({}) }));
const runBatch = vi.fn(async () => ({}) as unknown);
const requeueItems = vi.fn(async () => 2);
const approveItem = vi.fn(async () => undefined);
vi.mock('./studio-batch', async (original) => ({ ...(await original<object>()), runBatch, requeueItems, approveItem }));

const { applyAction, BatchAction } = await import('./studio-actions');

const scope = { db: {}, orgId: 'o', projectId: 'p', userId: 'u', batch: { id: 'b' } } as never;
const input = { itemIds: ['i1', 'i2'], variations: 1 };

describe('a studio batch action', () => {
  it('runs the batch', async () => {
    expect(await applyAction(scope, BatchAction.Run, input)).toEqual({ data: { ok: true } });
  });

  it('refuses a run the engine refuses as unprocessable', async () => {
    runBatch.mockResolvedValueOnce({ error: 'nope' });

    expect(await applyAction(scope, BatchAction.Run, input)).toEqual({ status: 422, error: 'nope' });
  });

  it('stops at the credit gate', async () => {
    gate.mockResolvedValueOnce({ status: 402, data: { message: 'out' } });

    expect(await applyAction(scope, BatchAction.Retry, input)).toEqual({ status: 402, error: 'out' });
    expect(requeueItems).not.toHaveBeenCalled();
  });

  it('requeues the items it is given', async () => {
    expect(await applyAction(scope, BatchAction.Regenerate, input)).toEqual({ data: { requeued: 2 } });
  });

  it('approves the first item', async () => {
    await applyAction(scope, BatchAction.Approve, input);

    expect(approveItem).toHaveBeenCalledWith({}, scope, { itemId: 'i1', approval: 'approved' });
  });
});
