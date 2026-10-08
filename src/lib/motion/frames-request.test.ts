import { describe, expect, it } from 'vitest';
import { AssetKind } from './components';
import { adoptAgentAssets, agentDraft, ASSETS_ADDED, CHECK_REQUEST, FRAMES_REQUEST, type AgentAsset } from './frames-request';
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
  const draft = { fps: 30 } as unknown as MotionDoc;
  const shown = { fps: 24 } as unknown as MotionDoc;

  it('a frames request moves the preview to the draft the agent is looking at', () => {
    expect(agentDraft(shown, { type: FRAMES_REQUEST, data: { callId: 'c', times: [0], doc: draft } })).toBe(draft);
  });

  it('parts without the whole draft leave the preview where it is, never back to the saved head', () => {
    expect(agentDraft(shown, { type: CHECK_REQUEST, data: { callId: 'c', name: 'X', doc: draft } })).toBe(shown);
    expect(agentDraft(shown, { type: ASSETS_ADDED, data: { assets: [] } })).toBe(shown);
  });
});
