import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { AssetKind } from '$lib/motion/components';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { createMotionTools, type MotionSession, type MotionToolDeps } from './motion-tools';
import type { MotionAsset } from './editor';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

const LOGO: MotionAsset = { id: 'logo1', kind: AssetKind.Image, label: 'logo', previewUrl: '', url: 'https://signed/logo.svg' };

function setup(sources: Partial<MotionToolDeps> = {}) {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const assets: MotionAsset[] = [];
  const tools = createMotionTools({ session, assets, newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), ...sources });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, assets, run };
}

describe('motion agent brand tools', () => {
  it('analyze_site hands the site read to the model as is', async () => {
    const site = vi.fn(async () => ({ ok: true as const, site: { name: 'Verde' } }));
    const { run } = setup({ site } as never);

    expect(await run('analyze_site', { url: 'verde.example' })).toEqual({ ok: true, site: { name: 'Verde' } });
    expect(site).toHaveBeenCalledWith('verde.example');
  });

  it('use_brand reads the project brand, or the one the user names', async () => {
    const brand = vi.fn(async (name?: string) => ({ ok: true as const, brand: { name: name ?? 'Project brand' } }));
    const { run } = setup({ brand } as never);

    expect(await run('use_brand', {})).toMatchObject({ brand: { name: 'Project brand' } });
    expect(await run('use_brand', { name: 'Rosso' })).toMatchObject({ brand: { name: 'Rosso' } });
  });

  it('import_asset makes the downloaded picture usable by add_clip in the same turn', async () => {
    const importAsset = vi.fn(async () => ({ ok: true as const, asset: LOGO, width: 200, height: 100 }));
    const { session, assets, run } = setup({ importAsset });

    expect(await run('import_asset', { url: 'https://verde.example/logo.svg', label: 'logo' })).toEqual({ ok: true, asset_id: 'logo1', kind: 'image', width: 200, height: 100 });
    expect(assets).toContain(LOGO);
    expect((await run('add_clip', { component: 'Logo3D', start: 0, duration: 3, props: { assetId: 'logo1' } })).ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.props.assetId).toBe('logo1');
    expect(session.doc.assets.map((a) => a.id)).toContain('logo1');
  });

  it('import_asset passes a refusal through without touching the assets', async () => {
    const { assets, run } = setup({ importAsset: vi.fn(async () => ({ ok: false as const, error: 'not an image' })) });

    expect(await run('import_asset', { url: 'https://verde.example/page' })).toEqual({ ok: false, error: 'not an image' });
    expect(assets).toEqual([]);
  });

  it('says so when this workspace cannot read sites, brands or imports', async () => {
    const { run } = setup();

    for (const [name, input] of [['analyze_site', { url: 'verde.example' }], ['use_brand', {}], ['import_asset', { url: 'https://verde.example/a.png' }]] as const) {
      expect(await run(name, input)).toMatchObject({ ok: false });
    }
  });

  it('the prompt carries the brand trailer recipe', () => {
    const prompt = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Available });

    for (const word of ['analyze_site', 'use_brand', 'import_asset', 'Logo3D', 'Device3D', 'view_frames']) {
      expect(prompt).toContain(word);
    }
    expect(prompt).toMatch(/trailer/i);
  });
});
