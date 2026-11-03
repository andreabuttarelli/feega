import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { SaveFailure } from '$lib/motion/frame-edit-session.svelte';
import { OpKind } from '$lib/motion/doc-ops';
import { frameDrafts, refusedNotice, sendResultOf } from './frame-save';

const doc = newMotionDoc(MotionFormat.Landscape);

describe('what a frame save answer means for the edit', () => {
  it('a success lands the new revision', () => {
    expect(sendResultOf({ type: 'success', status: 200, data: { version: 4, doc } })).toEqual({ ok: true, version: 4, doc });
  });

  it('a doc the server refuses is refused, with the server reason', () => {
    expect(sendResultOf({ type: 'failure', status: 400, data: { error: 'tracks: Too big' } })).toEqual({ ok: false, error: 'tracks: Too big', failure: SaveFailure.Refused });
  });

  it('a busy frame, a server error or a dropped line are sent again', () => {
    expect(sendResultOf({ type: 'failure', status: 409, data: { error: 'busy' } })).toMatchObject({ failure: SaveFailure.Transient });
    expect(sendResultOf({ type: 'error', status: 502, error: { message: 'bad gateway' } })).toMatchObject({ failure: SaveFailure.Transient });
  });

  it('a signed-out save is refused, so the user is told instead of a silent loop', () => {
    expect(sendResultOf({ type: 'redirect', status: 303, location: '/login' })).toMatchObject({ failure: SaveFailure.Refused });
  });

  it('the notice says the edit is still on this device', () => {
    expect(refusedNotice('tracks: Too big')).toContain('kept on this device');
  });
});

function memoryShelf() {
  const held = new Map<string, unknown>();
  return { read: async (key: string) => held.get(key), write: async (key: string, value: unknown) => void held.set(key, value) };
}

describe('the frame drafts shelf', () => {
  const draft = { version: 3, ops: [{ kind: OpKind.DocSet, field: 'durationInFrames', value: 60 }] };

  it('reads back the draft kept for a frame of this canvas', async () => {
    const drafts = frameDrafts('c1', memoryShelf());

    await drafts.keep('n1', draft);

    expect(await drafts.read('n1')).toEqual(draft);
  });

  it('a released draft is gone', async () => {
    const drafts = frameDrafts('c1', memoryShelf());
    await drafts.keep('n1', draft);

    await drafts.release('n1');

    expect(await drafts.read('n1')).toBeNull();
  });

  it('a shelf that cannot be read has no draft', async () => {
    const drafts = frameDrafts('c1', { read: async () => Promise.reject(new Error('blocked')), write: async () => {} });

    expect(await drafts.read('n1')).toBeNull();
  });
});
