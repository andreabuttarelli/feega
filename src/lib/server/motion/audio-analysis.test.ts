import { describe, expect, it, vi } from 'vitest';
import { ANALYSIS_VERSION } from '$lib/motion/audio-analysis';
import { AssetKind } from '$lib/motion/components';
import { analysisFor, analysisPath, analyzeSounds, type AnalysisDeps } from './audio-analysis';

const RATE = 22_050;
const ref = { orgId: 'o', projectId: 'p', assetId: 'a1', url: 'https://x/a.mp3' };

function clicks(): Float32Array {
  const out = new Float32Array(RATE * 4);
  for (let t = 0; t < 4; t += 0.5) {
    out[Math.round(t * RATE)] = 1;
  }
  return out;
}

function deps(stored: Record<string, string> = {}): AnalysisDeps & { saved: Record<string, string> } {
  const saved: Record<string, string> = { ...stored };
  return {
    saved,
    read: vi.fn(async (path: string) => saved[path] ?? null),
    write: vi.fn(async (path: string, json: string) => {
      saved[path] = json;
    }),
    decode: vi.fn(async () => ({ samples: clicks(), rate: RATE }))
  };
}

describe('analysisFor', () => {
  it('lives next to the asset, one file per analysis version', () => {
    expect(analysisPath(ref)).toBe(`o/p/analysis/a1.v${ANALYSIS_VERSION}.json`);
  });

  it('decodes and analyses an asset once, then stores the result', async () => {
    const d = deps();
    const first = await analysisFor(d, ref);

    expect(first?.bpm).toBe(120);
    expect(JSON.parse(d.saved[analysisPath(ref)])).toEqual(first);
    expect(d.decode).toHaveBeenCalledWith(ref.url);
  });

  it('a stored analysis is read back, nothing decoded', async () => {
    const d = deps();
    await analysisFor(d, ref);
    const again = deps(d.saved);

    expect((await analysisFor(again, ref))?.bpm).toBe(120);
    expect(again.decode).not.toHaveBeenCalled();
  });

  it('an analysis of an older version is redone', async () => {
    const d = deps({ [analysisPath(ref)]: JSON.stringify({ version: 0 }) });
    expect((await analysisFor(d, ref))?.version).toBe(ANALYSIS_VERSION);
  });

  it('a store that refuses the write still answers with the analysis', async () => {
    const d = deps();
    d.write = vi.fn(async () => {
      throw new Error('exists');
    });

    expect((await analysisFor(d, ref))?.bpm).toBe(120);
  });

  it('a file that will not decode gives no analysis, and nothing is stored', async () => {
    const d = deps();
    d.decode = vi.fn(async () => {
      throw new Error('bad file');
    });

    expect(await analysisFor(d, ref)).toBeNull();
    expect(d.write).not.toHaveBeenCalled();
  });
});

describe('analyzeSounds', () => {
  const asset = (id: string, kind: AssetKind, url: string | null = `https://x/${id}`) => ({ id, kind, label: id, previewUrl: '', url });

  it('analyses the asked audio and video assets that have a file, keyed by asset', async () => {
    const d = deps();
    const assets = [asset('music', AssetKind.Audio), asset('clip', AssetKind.Video), asset('pic', AssetKind.Image), asset('gone', AssetKind.Audio, null)];
    const result = await analyzeSounds(d, { orgId: 'o', projectId: 'p' }, assets, ['music', 'clip', 'pic', 'gone', 'unknown']);

    expect(Object.keys(result).sort()).toEqual(['clip', 'music']);
  });
});
