import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { sourceAssets } from './sources';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const LIBRARY_SIZE = 201;

const idOf = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

const asset = (i: number) => ({
  id: idOf(i),
  org_id: ORG,
  project_id: PROJECT,
  type: 'image',
  url: `${ORG}/${idOf(i)}`,
  content: null,
  mime_type: 'image/png',
  bytes: 1,
  width: null,
  height: null,
  duration_s: null,
  source: 'upload',
  source_node_id: null,
  uncensored: false,
  created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString()
});

const using = (ids: string[]): MotionDoc => ({ ...newMotionDoc(MotionFormat.Square), tracks: [{ clips: ids.map((assetId) => ({ props: { assetId } })) }] as never });

describe('sourceAssets', () => {
  it('resolves an asset the doc uses even when the project holds more than the library shows', async () => {
    const { db } = fakeDb({ assets: Array.from({ length: LIBRARY_SIZE }, (_, i) => asset(i)) }, { filter: true });
    const sign = async (paths: { uploaded: string[] }) => new Map(paths.uploaded.map((p) => [p, `signed:${p}`]));

    const urls = await sourceAssets({ db, orgId: ORG, projectId: PROJECT, canvasId: 'c', sign }, using([idOf(0), idOf(LIBRARY_SIZE - 1)]));

    expect(urls).toEqual({ [idOf(0)]: `signed:${ORG}/${idOf(0)}`, [idOf(LIBRARY_SIZE - 1)]: `signed:${ORG}/${idOf(LIBRARY_SIZE - 1)}` });
  });
});
