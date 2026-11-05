import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { WATERMARK_TEXT } from '@feega/motion-core/motion/watermark';
import type { DrawPorts } from './selection-draw';
import type { DrawTarget } from './selection-export';

const seen = vi.hoisted(() => ({ ports: null as DrawPorts | null }));

vi.mock('./selection-draw', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./selection-draw')>()),
  drawTargets: async (ports: DrawPorts) => {
    seen.ports = ports;
    return [];
  }
}));
vi.mock('./editor', async (importOriginal) => ({ ...(await importOriginal<typeof import('./editor')>()), motionAssets: async () => [], motionTokens: async () => ({ name: 'feega', colors: {}, logoUrl: null }) }));

const { selectionPorts } = await import('./selection-export-ports');

const target = { nodeId: 'n1', doc: newMotionDoc(MotionFormat.Landscape), docScale: 1, name: 'Frame' } as unknown as DrawTarget;

async function composed(subscription: string | null): Promise<string> {
  const { db } = fakeDb({ orgs: [{ id: 'o', stripe_subscription_id: subscription }] }, { filter: true });
  const ports = selectionPorts({ db, orgId: 'o', projectId: 'p', brandId: null, actor: { kind: 'user', id: 'u' } });
  await ports.draw([target], {} as never);
  return seen.ports!.compose(target);
}

describe('a selection exported on the server', () => {
  it('draws the watermark for a free org', async () => {
    expect(await composed(null)).toContain(WATERMARK_TEXT);
  });

  it('is clean for a paid org', async () => {
    expect(await composed('sub_1')).not.toContain(WATERMARK_TEXT);
  });
});
