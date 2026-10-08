import { fail } from '@sveltejs/kit';
import type { Db } from '$lib/server/db/client';
import { nodeGalleryItem, remixOrigin } from '$lib/server/repos/gallery';
import { splitTags } from '$lib/gallery/model';
import { publishStatus } from './http';
import { withdrawFromGallery } from './publish';
import { publishNode, type GalleryScope } from './service';

export type EditorGallery = { listed: { id: string; title: string } | null; remixOf: { id: string; title: string; authorName: string } | null };

const HTTP_NOT_FOUND = 404;
const NONE: EditorGallery = { listed: null, remixOf: null };

export async function editorGallery(db: Db, scope: { orgId: string; nodeId: string }): Promise<EditorGallery> {
  try {
    const [listed, remixOf] = await Promise.all([nodeGalleryItem(db, scope), remixOrigin(db, scope)]);
    return { listed: listed ? { id: listed.id, title: listed.title } : null, remixOf };
  } catch (error) {
    console.error('[gallery] editor state unavailable', error);
    return NONE;
  }
}

export async function publishFromForm(scope: GalleryScope, nodeId: string, form: FormData) {
  const meta = { title: String(form.get('title') ?? ''), description: String(form.get('description') ?? ''), tags: splitTags(String(form.get('tags') ?? '')) };
  const published = await publishNode(scope, { nodeId, meta });
  return published.ok ? { id: published.id } : fail(publishStatus(published.error), { error: published.message });
}

export async function withdrawFromForm(scope: GalleryScope, form: FormData) {
  const withdrawn = await withdrawFromGallery(scope.db, { orgId: scope.orgId, itemId: String(form.get('id') ?? '') });
  return withdrawn ? { withdrawn: true } : fail(HTTP_NOT_FOUND, { error: 'This item is not in the gallery.' });
}
