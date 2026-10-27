import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

vi.mock('$lib/server/raster-image', () => ({
  readUploadImage: vi.fn(async () => ({ ok: true, mime: 'image/png', bytes: new Uint8Array([1]) }))
}));

const { kitActions, loadKit } = await import('./brand-kit');

const BRAND = { id: 'b1', org_id: 'org-1', logo_url: null, palette: [], voice: {}, logos: [] };

function setup(over: Record<string, unknown[]> = {}) {
  const fake = fakeDb({ projects: [{ id: 'p1', brand_id: 'b1', org_id: 'org-1' }], brands: [{ ...BRAND }], brand_fonts: [], assets: [], canvases: [{ id: 'c1', project_id: 'p1' }], ...over }, { filter: true });
  const event = (fields: Record<string, string | File>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return { request: new Request('http://x', { method: 'POST', body: fd }), params: { projectId: 'p1' }, locals: { supabase: fake.db } } as never;
  };
  const updates = (table: string) => fake.calls.filter((c) => c.table === table && c.op === 'update').map((c) => c.payload);
  return { fake, event, updates };
}

describe('brand kit settings actions', () => {
  it('saveKit writes the palette and voice parsed from the form', async () => {
    const { event, updates } = setup();
    expect(await kitActions.saveKit(event({ palette: '#111111 Ink', tone: 'Warm', do: '', dont: '' }))).toEqual({ saved: true });
    expect(updates('brands')[0]).toMatchObject({ palette: [{ hex: '#111111', name: 'Ink' }], voice: { tone: 'Warm' } });
  });

  it('saveKit refuses a bad colour without writing', async () => {
    const { event, updates } = setup();
    const out = (await kitActions.saveKit(event({ palette: 'blue' }))) as { status: number };
    expect(out.status).toBe(400);
    expect(updates('brands')).toEqual([]);
  });

  it('uploadLogoVariant stores the file and records the variant; primary also sets logo_url', async () => {
    const { event, updates, fake } = setup();
    const file = new File([new Uint8Array([1])], 'l.png', { type: 'image/png' });
    await kitActions.uploadLogoVariant(event({ variant: 'primary', file }));
    expect(fake.calls.some((c) => c.table === 'storage:media' && c.op === 'upload')).toBe(true);
    const patch = updates('brands')[0] as { logos: Array<{ variant: string }>; logo_url: string };
    expect(patch.logos.map((l) => l.variant)).toEqual(['primary']);
    expect(patch.logo_url).toMatch(/^https:\/\/public\.example\/media\/b1\/logo-primary-/);
  });

  it('saveFonts upserts the chosen roles and clears the empty ones', async () => {
    const { event, fake } = setup();
    await kitActions.saveFonts(event({ font_heading: 'Inter', font_body: '', font_accent: '' }));
    const upsert = fake.calls.find((c) => c.table === 'brand_fonts' && c.op === 'upsert');
    expect(upsert?.payload).toEqual([{ org_id: 'org-1', brand_id: 'b1', role: 'heading', org_font_id: null, google_family: 'Inter' }]);
    const del = fake.calls.find((c) => c.table === 'brand_fonts' && c.op === 'delete');
    expect(del?.filters).toEqual(expect.arrayContaining([['brand_id', 'b1'], ['role', ['body', 'accent']]]));
  });

  it('toggleApproved links an org asset to the brand, and unlinks it', async () => {
    const { event, updates } = setup({ assets: [{ id: 'a1', org_id: 'org-1', type: 'image' }] });
    await kitActions.toggleApproved(event({ assetId: 'a1', approved: 'true' }));
    await kitActions.toggleApproved(event({ assetId: 'a1', approved: 'false' }));
    const [on, off] = updates('assets') as Array<{ brand_id: string | null; approved_at: string | null }>;
    expect(on.brand_id).toBe('b1');
    expect(on.approved_at).not.toBeNull();
    expect(off).toEqual({ brand_id: null, approved_at: null });
  });

  it('loadKit returns the form fields, logos, fonts and recent assets with their approval', async () => {
    const { fake } = setup({
      brands: [{ ...BRAND, palette: [{ hex: '#111111' }], logos: [{ variant: 'dark', url: 'https://x/d.png' }] }],
      brand_fonts: [{ org_id: 'org-1', brand_id: 'b1', role: 'body', google_family: 'Lora', org_font_id: null }],
      assets: [{ id: 'a1', org_id: 'org-1', type: 'image', brand_id: 'b1', approved_at: '2026-10-01', created_at: '2026-10-01' }]
    });
    const kit = await loadKit(fake.db, { projectId: 'p1', orgId: 'org-1', brandId: 'b1' });
    expect(kit.fields.palette).toBe('#111111');
    expect(kit.logos).toEqual([{ variant: 'dark', url: 'https://x/d.png' }]);
    expect(kit.fonts.body).toEqual({ google_family: 'Lora', org_font_id: null });
    expect(kit.assets).toEqual([{ id: 'a1', approved: true, thumb: '/p/p1/c/c1/assets/a1?size=thumb' }]);
  });
});
