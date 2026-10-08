import { loadSession } from '../lib/auth.ts';
import { galleryApi, type GalleryCard, type GallerySearch } from '../lib/gallery.ts';

async function token(): Promise<string> {
  const session = await loadSession();
  if (!session) {
    console.error('Session expired or missing. Run: feega login');
    process.exit(1);
  }
  return session.access_token;
}

function printCard(card: GalleryCard) {
  const origin = card.remix_of ? ` · remix of ${card.remix_of}` : '';
  console.log(`${card.id}  ${card.title}  by ${card.author}${origin}`);
  console.log(`  ${card.kind} · ${card.format} · ${card.seconds} s · ${card.remixes} remixes  ${card.url}`);
}

export async function cmdGallery(query: string | undefined, opts: Omit<GallerySearch, 'query'>) {
  const { items } = await galleryApi.search(await token(), { ...opts, query });
  if (!items.length) {
    console.log('Nothing in the gallery matches.');
    return;
  }
  items.forEach(printCard);
}

export async function cmdGalleryRemix(itemId: string, opts: { project: string; canvas?: string; org?: string }) {
  const remixed = await galleryApi.remix(await token(), itemId, { project_id: opts.project, ...(opts.canvas ? { canvas_id: opts.canvas } : {}) }, opts.org);
  console.log(`Remixed "${remixed.title}" into node ${remixed.node_id}.`);
  console.log(`Open it: ${remixed.editor_url}`);
  console.log(`Put your brand on it: feega motion ask ${remixed.node_id} "Apply my brand"`);
}

export async function cmdGalleryPublish(nodeId: string, opts: { title: string; description?: string; tags?: string; org?: string }) {
  const tags = opts.tags?.split(',').map((t) => t.trim()).filter(Boolean);
  const published = await galleryApi.publish(await token(), { node_id: nodeId, title: opts.title, description: opts.description, tags }, opts.org);
  console.log(`Published: ${published.url}`);
}

export async function cmdGalleryWithdraw(itemId: string, opts: { org?: string }) {
  await galleryApi.withdraw(await token(), itemId, opts.org);
  console.log(`Withdrawn ${itemId}. Copies already remixed stay with their owners.`);
}
