import { describe, expect, it } from 'vitest';
import { AssetKind } from './components';
import { adoptAgentAssets, agentDraft, landTurn, ASSETS_ADDED, CHECK_REQUEST, DOC_EDITED, FRAMES_REQUEST, Head, Landing, type AgentAsset, type AgentDraft } from './frames-request';
import type { MotionDoc } from './doc';

const asset = (id: string, url: string): AgentAsset => ({ id, kind: AssetKind.Image, label: id, previewUrl: '', url });

describe('assets the agent brings in during a turn reach the editor preview', () => {
  it('adds the new ones in front and keeps the ones the editor already knows', () => {
    const known = [asset('a', 'https://signed/a')];

    expect(adoptAgentAssets(known, [asset('b', 'https://signed/b'), asset('a', 'https://signed/a2')]).map((a) => [a.id, a.url])).toEqual([
      ['b', 'https://signed/b'],
      ['a', 'https://signed/a']
    ]);
  });

  it('a request without assets changes nothing', () => {
    const known = [asset('a', 'https://signed/a')];

    expect(adoptAgentAssets(known, undefined)).toBe(known);
  });
});

describe('the editor keeps showing the agent draft while a turn is in flight', () => {
  const doc = (fps: number) => ({ fps }) as unknown as MotionDoc;
  const shown: AgentDraft = { edit: 2, doc: doc(24) };
  const edited = (edit: number, d: MotionDoc) => ({ type: DOC_EDITED, data: { edit, doc: d } });

  it('each streamed edit moves the preview forward, in order', () => {
    const one = agentDraft(null, edited(1, doc(1)));
    const two = agentDraft(one, edited(2, doc(2)));

    expect(two).toEqual({ edit: 2, doc: doc(2) });
  });

  it('an edit older than the one shown never moves the preview back', () => {
    expect(agentDraft(shown, edited(1, doc(1)))).toBe(shown);
  });

  it('a frames request moves the preview to the draft the agent is looking at', () => {
    expect(agentDraft(shown, { type: FRAMES_REQUEST, data: { callId: 'c', times: [0], doc: doc(30) } })).toEqual({ edit: 2, doc: doc(30) });
  });

  it('parts without the whole draft leave the preview where it is, never back to the saved head', () => {
    expect(agentDraft(shown, { type: CHECK_REQUEST, data: { callId: 'c', name: 'X', doc: doc(30) } })).toBe(shown);
    expect(agentDraft(shown, { type: ASSETS_ADDED, data: { assets: [] } })).toBe(shown);
  });
});

describe('a finished turn lands on the saved head, never on an older doc', () => {
  const draft: AgentDraft = { edit: 3, doc: { fps: 30 } as unknown as MotionDoc };

  it('a newer saved head replaces the draft', () => {
    expect(landTurn(draft, Head.Newer)).toBe(Landing.Head);
  });

  it('no newer head keeps the agent work and saves it from the editor', () => {
    expect(landTurn(draft, Head.Same)).toBe(Landing.KeepDraft);
  });

  it('a turn without edits changes nothing', () => {
    expect(landTurn(null, Head.Same)).toBe(Landing.Nothing);
    expect(landTurn(null, Head.Newer)).toBe(Landing.Head);
  });
});
