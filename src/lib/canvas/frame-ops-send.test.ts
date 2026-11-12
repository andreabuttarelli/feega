import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { OpKind } from '$lib/motion/doc-ops';
import { Delivery } from '$lib/motion/frame-edit-session.svelte';
import { SendResult } from './save-scheduler';
import { frameOpsForm, frameSendOf, queueResultOf } from './frame-ops-send';

const doc = newMotionDoc(MotionFormat.Landscape);

describe('frame ops: one answer reading for the session and the reload replay', () => {
  it('a saved answer carries the new revision', () => {
    expect(frameSendOf({ type: 'success', status: 200, data: { version: 4, doc } })).toEqual({ ok: true, version: 4, doc });
  });

  it('no network, a server error or a busy frame is unreachable, so it is sent again', () => {
    expect(frameSendOf({ type: 'network' })).toMatchObject({ ok: false, delivery: Delivery.Unreachable });
    expect(frameSendOf({ type: 'error', status: 500 })).toMatchObject({ ok: false, delivery: Delivery.Unreachable });
    expect(frameSendOf({ type: 'failure', status: 409, data: { error: 'busy' } })).toMatchObject({ ok: false, delivery: Delivery.Unreachable });
  });

  it('ops the frame refuses are refused, so they are not sent again', () => {
    expect(frameSendOf({ type: 'failure', status: 400, data: { error: 'invalid_ops' } })).toEqual({ ok: false, error: 'Save failed', delivery: Delivery.Refused });
  });

  it('a conflict that carries the newer head is not sent again: the session loads that head', () => {
    const sent = frameSendOf({ type: 'failure', status: 409, data: { error: 'conflict', head: { version: 5, doc } } });

    expect(sent).toMatchObject({ ok: false, delivery: Delivery.Conflict, head: { version: 5, doc } });
    expect(queueResultOf(sent)).toBe(SendResult.Dropped);
  });

  it('maps onto the queue result the outbox replay understands', () => {
    expect(queueResultOf({ ok: true, version: 2, doc })).toBe(SendResult.Saved);
    expect(queueResultOf({ ok: false, error: 'x', delivery: Delivery.Unreachable })).toBe(SendResult.Retry);
    expect(queueResultOf({ ok: false, error: 'x' })).toBe(SendResult.Dropped);
  });

  it('sends the ops on the revision they were made from', () => {
    const form = frameOpsForm({ version: 3, ops: [{ kind: OpKind.DocSet, field: 'durationInFrames', value: 90 }], summary: 'Fill' });

    expect(Object.fromEntries(form)).toEqual({ ops: '[{"kind":"doc.set","field":"durationInFrames","value":90}]', version: '3', summary: 'Fill' });
  });
});
