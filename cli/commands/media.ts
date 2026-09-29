import { loadSession } from '../lib/auth.ts';
import { api } from '../lib/api.ts';
import { section, info, warn } from '../lib/display.ts';

type MediaOpts = { node?: string; run?: string; asset?: string; org?: string };

const split = (v?: string) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);

export async function cmdMedia(opts: MediaOpts) {
  const session = await loadSession();
  if (!session) {
    console.error('Session expired or missing. Run: feega login');
    process.exit(1);
  }

  const media = await api.getMedia(session.access_token, {
    node: split(opts.node),
    run: split(opts.run),
    asset: split(opts.asset),
    org: opts.org
  });

  for (const item of media.items) {
    const size = item.width && item.height ? `${item.width}×${item.height}` : '';
    section(`${item.type} ${item.assetId} ${size}`.trim());
    if (item.previewUrl) {
      console.log(`  preview  ${item.previewUrl}`);
    }
    if (item.fullUrl) {
      console.log(`  full     ${item.fullUrl}`);
    }
    if (item.text) {
      console.log(item.text);
    }
  }

  if (media.missing.length) {
    warn(`Not found: ${media.missing.join(', ')}`);
  }
  info('Links expire in a few minutes.');
}
