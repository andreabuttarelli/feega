import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { listMemberships } from '$lib/server/repos/orgs';
import { findProjectById } from '$lib/server/repos/projects';
import { itemPath, publishMetaSchema, type GalleryCard } from '$lib/gallery/model';
import { galleryModeration } from './moderation';
import { publishToGallery, type Published } from './publish';
import { remixGalleryItem, RemixError, type Remixed } from './remix';

export type GalleryScope = { db: Db; orgId: string; userId: string; actor: Actor };

const UNNAMED_AUTHOR = 'feega user';

export const INVALID_META = 'invalid_meta';

async function authorName(db: Db, scope: { orgId: string; userId: string }): Promise<string> {
  const memberships = await listMemberships(db, scope.userId);
  return memberships.find((m) => m.org.id === scope.orgId)?.org.name.trim().slice(0, 60) || UNNAMED_AUTHOR;
}

export async function publishNode(scope: GalleryScope, input: { nodeId: string; meta: unknown }): Promise<Published> {
  const meta = publishMetaSchema.safeParse(input.meta);
  if (!meta.success) {
    return { ok: false, error: INVALID_META, message: meta.error.issues.map((i) => `${i.path.join('.') || 'meta'}: ${i.message}`).join('; ') };
  }
  return publishToGallery(scope.db, { moderation: galleryModeration(scope.db, scope) }, {
    orgId: scope.orgId,
    userId: scope.userId,
    authorName: await authorName(scope.db, scope),
    actor: scope.actor,
    nodeId: input.nodeId,
    meta: meta.data
  });
}

export async function remixInto(scope: GalleryScope, input: { itemId: string; projectId: string; canvasId: string | null }): Promise<Remixed> {
  const project = await findProjectById(scope.db, { orgId: scope.orgId, projectId: input.projectId });
  if (!project) {
    return { ok: false, error: RemixError.ProjectNotFound, message: 'No project with that id in your workspace.' };
  }
  return remixGalleryItem(scope.db, {}, { orgId: scope.orgId, userId: scope.userId, actor: scope.actor, itemId: input.itemId, projectId: project.id, canvasId: input.canvasId });
}

export function cardView(card: GalleryCard, origin = '') {
  return {
    id: card.id,
    title: card.title,
    author: card.authorName,
    kind: card.kind,
    format: card.format,
    seconds: card.durationS,
    tags: card.tags,
    remixes: card.remixCount,
    remix_of: card.remixedFrom?.title ?? null,
    url: `${origin}${itemPath(card.id)}`
  };
}
