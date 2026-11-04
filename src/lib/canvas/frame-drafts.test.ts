import { describe, expect, it } from 'vitest';
import { OpKind } from '$lib/motion/doc-ops';
import { SendResult } from './save-scheduler';
import { draftLog, replayDrafts, type DraftEntry } from './frame-drafts';

const draft = (id: string, nodeId = 'n1'): DraftEntry => ({ id, nodeId, version: 3, ops: [{ kind: OpKind.DocSet, field: 'durationInFrames', value: 90 }], summary: 'Fill' });

describe('frame drafts: element content not yet saved survives a reload', () => {
  it('keeps one draft per editing session, replaced by each edit and cleared when it lands', () => {
    const saved: string[][] = [];
    const log = draftLog([], (entries) => saved.push(entries.map((e) => `${e.id}@${e.version}`)));

    log.keep('s1', 'n1', { version: 3, ops: [], summary: 'A' });
    log.keep('s1', 'n1', { version: 4, ops: [], summary: 'B' });
    log.keep('s2', 'n2', { version: 1, ops: [], summary: 'C' });
    log.keep('s1', 'n1', null);

    expect(log.all().map((e) => e.id)).toEqual(['s2']);
    expect(saved).toEqual([['s1@3'], ['s1@4'], ['s1@4', 's2@1'], ['s2@1']]);
  });

  it('after a reload sends what was left and drops what the server answered', async () => {
    const sent: string[] = [];
    const log = draftLog([draft('old-1'), draft('old-2', 'n2'), draft('live')], () => {});

    const left = await replayDrafts(log, [draft('old-1'), draft('old-2', 'n2')], async (entry) => {
      sent.push(`${entry.nodeId}@${entry.version}`);
      return entry.id === 'old-1' ? SendResult.Saved : SendResult.Dropped;
    });

    expect(sent).toEqual(['n1@3', 'n2@3']);
    expect(left).toBe(0);
    expect(log.all().map((e) => e.id)).toEqual(['live']);
  });

  it('keeps a draft the network did not deliver, for the next try', async () => {
    const log = draftLog([draft('old')], () => {});

    const left = await replayDrafts(log, [draft('old')], async () => {
      throw new TypeError('Failed to fetch');
    });

    expect(left).toBe(1);
    expect(log.all().map((e) => e.id)).toEqual(['old']);
  });
});
