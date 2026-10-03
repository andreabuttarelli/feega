import { describe, expect, it } from 'vitest';
import { newStudioBatchData, studioBatchOf, studioBatchSummary } from './studio-batch-node';
import { Approval, ItemStatus } from '$lib/studio/batch-state';

describe('the studio batch node', () => {
  it('a new node has no batch yet: the user picks one', () => {
    expect(studioBatchOf({ id: 'n', type: 'studio_batch', data: newStudioBatchData() })).toEqual({ id: 'n', batchId: null });
  });

  it('carries the batch it summarises', () => {
    expect(studioBatchOf({ id: 'n', type: 'studio_batch', data: { batchId: 'b1' } })?.batchId).toBe('b1');
  });

  it('another type is not a studio batch node', () => {
    expect(studioBatchOf({ id: 'n', type: 'products', data: { batchId: 'b1' } })).toBeNull();
  });

  it('a broken payload falls back to an unpicked node', () => {
    expect(studioBatchOf({ id: 'n', type: 'studio_batch', data: { batchId: 42 } })?.batchId).toBeNull();
  });
});

describe('what the node shows and what it hands downstream', () => {
  const item = (status: ItemStatus, approval: Approval, assetId: string | null) => ({ status, approval, assetId });

  it('counts by status and hands on only the approved photos that exist', () => {
    const summary = studioBatchSummary([
      item(ItemStatus.Done, Approval.Approved, 'a1'),
      item(ItemStatus.Done, Approval.Pending, 'a2'),
      item(ItemStatus.Done, Approval.Approved, null),
      item(ItemStatus.Running, Approval.Pending, null),
      item(ItemStatus.Failed, Approval.Pending, null)
    ]);

    expect(summary).toEqual({ total: 5, done: 3, running: 1, failed: 1, approvedAssetIds: ['a1'] });
  });
});
