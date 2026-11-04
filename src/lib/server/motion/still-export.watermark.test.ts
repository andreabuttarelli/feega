import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { ImageFormat, ImageScale, stillExport } from '@feega/motion-core/motion/still-model';
import { WATERMARK_TEXT } from '@feega/motion-core/motion/watermark';
import { exportStill } from './still-export';
import type { StillPort } from './server-frames';

const TOKENS = { name: 'feega', colors: {}, fonts: {} } as never;

async function drawnHtml(subscription: string | null): Promise<string> {
  vi.stubEnv('CHROMIUM_PATH', '/chrome');
  const html: string[] = [];
  const port: StillPort = {
    open: async () => ({
      load: async (page: string) => {
        html.push(page);
      },
      seek: async () => {},
      jpeg: async () => Buffer.from(''),
      picture: async () => Promise.reject(new Error('stop here')),
      close: async () => {}
    })
  };
  const { db } = fakeDb({ orgs: [{ id: 'o', stripe_subscription_id: subscription }] }, { filter: true });

  await exportStill(db, { orgId: 'o', projectId: 'p', nodeId: 'n' }, newMotionDoc(MotionFormat.Square), stillExport(ImageFormat.Png, ImageScale.One, 1), { tokens: TOKENS, assets: [] }, port);
  vi.unstubAllEnvs();
  return html[0];
}

describe('an exported image', () => {
  it('carries the watermark for a free org', async () => {
    expect(await drawnHtml(null)).toContain(WATERMARK_TEXT);
  });

  it('is clean for a paid org', async () => {
    expect(await drawnHtml('sub_1')).not.toContain(WATERMARK_TEXT);
  });
});
