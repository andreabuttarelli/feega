import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { FontFormat, deleteFontFamily, fontFormatOf, orgFontPrefix, orgFontFamilies, renameFontFamily, saveFontUpload } from './font-upload';

const ORG = '11111111-1111-1111-1111-111111111111';
const FRAUNCES = new Uint8Array(readFileSync('static/fonts/fraunces-latin.woff2'));
const WOFF2_STUB = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 1, 2, 3]);

const INSIDE = `${orgFontPrefix(ORG)}x.woff2`;

function withStorage(bytes: Uint8Array | null, rows: Record<string, unknown[]> = { assets: [] }) {
  const fake = fakeDb(rows, { filter: true, store: true, mutate: true, files: bytes ? { [INSIDE]: bytes } : {} });
  const removed = () => fake.calls.filter((c) => c.op === 'remove').map((c) => c.filters[0][1]);
  return { ...fake, removed };
}

const fontRow = (id: string, family: string, weight: number) => ({
  id,
  org_id: ORG,
  project_id: null,
  type: 'document',
  url: `${ORG}/fonts/${id}.woff2`,
  content: JSON.stringify({ family, weight, italic: false }),
  mime_type: 'font/woff2',
  bytes: 10,
  created_at: '2026-10-19T00:00:00Z'
});

describe('font uploads', () => {
  it('recognises font files by their bytes, not their name', () => {
    expect(fontFormatOf(WOFF2_STUB)).toBe(FontFormat.Woff2);
    expect(fontFormatOf(new Uint8Array([0x4f, 0x54, 0x54, 0x4f]))).toBe(FontFormat.Otf);
    expect(fontFormatOf(new Uint8Array([0, 1, 0, 0]))).toBe(FontFormat.Ttf);
    expect(fontFormatOf(new TextEncoder().encode('<svg>'))).toBeNull();
  });

  it('files a real font in the org library under the family its name table declares', async () => {
    const { db, calls } = withStorage(FRAUNCES);
    const saved = await saveFontUpload(db, { orgId: ORG, path: INSIDE });

    expect(saved).toMatchObject({ ok: true, format: FontFormat.Woff2, font: { family: 'Fraunces', italic: false } });
    const insert = calls.find((c) => c.op === 'insert')?.payload as Record<string, unknown>;
    expect(insert).toMatchObject({ org_id: ORG, project_id: null, type: 'document', mime_type: 'font/woff2', bytes: FRAUNCES.length });
    expect(JSON.parse(String(insert.content))).toMatchObject({ family: 'Fraunces' });
  });

  it('refuses a path outside the org font folder and deletes a file that is not a font', async () => {
    const { db, removed } = withStorage(new TextEncoder().encode('<script>'));

    expect(await saveFontUpload(db, { orgId: ORG, path: `other/fonts/x.woff2` })).toEqual({ ok: false, error: 'invalid_path' });
    expect(await saveFontUpload(db, { orgId: ORG, path: `${orgFontPrefix(ORG)}../x.woff2` })).toEqual({ ok: false, error: 'invalid_path' });
    expect(await saveFontUpload(db, { orgId: ORG, path: INSIDE })).toMatchObject({ ok: false, error: expect.stringContaining('not a font') });
    expect(removed()).toEqual([[INSIDE]]);
  });

  it('lists, renames and deletes whole families', async () => {
    const rows = { assets: [fontRow('r', 'Acme', 400), fontRow('b', 'Acme', 700), fontRow('s', 'Serif', 400)] };
    const { db, removed } = withStorage(null, rows);

    expect((await orgFontFamilies(db, ORG)).map((f) => [f.family, f.variants.length])).toEqual([['Acme', 2], ['Serif', 1]]);
    expect(await renameFontFamily(db, { orgId: ORG, family: 'Acme', to: 'Acme Sans' })).toEqual({ ok: true });
    expect(await renameFontFamily(db, { orgId: ORG, family: 'Serif', to: 'Acme Sans' })).toMatchObject({ ok: false });
    expect(await renameFontFamily(db, { orgId: ORG, family: 'Serif', to: 'bad/name' })).toMatchObject({ ok: false });
    expect((await orgFontFamilies(db, ORG)).map((f) => f.family)).toEqual(['Acme Sans', 'Serif']);

    expect(await deleteFontFamily(db, { orgId: ORG, family: 'Acme Sans' })).toEqual({ ok: true });
    expect(removed()).toEqual([[`${ORG}/fonts/r.woff2`, `${ORG}/fonts/b.woff2`]]);
    expect(await deleteFontFamily(db, { orgId: ORG, family: 'Nope' })).toMatchObject({ ok: false });
  });
});

