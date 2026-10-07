import { describe, expect, it } from 'vitest';
import { AssetKind } from './components';
import { adoptAgentAssets, type AgentAsset } from './frames-request';

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
