import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { saveMotionDoc } from './editor';

const db = {} as never;
const actor = { kind: 'user' as const, id: 'u' };
const valid = newMotionDoc(MotionFormat.Landscape);

const MALFORMED: [string, unknown][] = [
  ['null', null],
  ['a number', 7],
  ['a string', 'doc'],
  ['an array', []],
  ['no tracks', { ...valid, tracks: undefined }],
  ['tracks not an array', { ...valid, tracks: {} }],
  ['a null track', { ...valid, tracks: [null] }],
  ['a track without clips', { ...valid, tracks: [{}] }],
  ['clips not an array', { ...valid, tracks: [{ id: 't', clips: 'x' }] }],
  ['a null clip', { ...valid, tracks: [{ id: 't', clips: [null] }] }],
  ['a clip without props', { ...valid, tracks: [{ id: 't', clips: [{ id: 'c', kind: 'text', start: 0, duration: 1 }] }] }],
  ['a clip without transform', { ...valid, tracks: [{ id: 't', clips: [{ id: 'c', kind: 'text', start: 0, duration: 1, props: {} }] }] }]
];

describe('saving a malformed doc answers invalid instead of throwing', () => {
  it.each(MALFORMED)('%s', async (_name, doc) => {
    const write = await saveMotionDoc(db, { orgId: 'o', nodeId: 'n', expectedVersion: 1, doc, actor });

    expect(write.outcome).toBe(RevisionOutcome.Invalid);
  });
});
