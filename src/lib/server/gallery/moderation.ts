import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import { screenModelInput } from '$lib/server/moderation/model-input';
import { ModerationProfile } from '$lib/server/moderation/profiles';
import { screenGalleryMedia } from '$lib/server/moderation/gallery-media';
import { galleryMediaJudge } from '$lib/server/moderation/moderation-config';
import type { GalleryModeration } from './publish';

export function galleryModeration(db: Db, scope: { orgId: string; userId: string; actor: Actor }): GalleryModeration {
  return {
    text: (texts) => screenModelInput(db, { profile: ModerationProfile.Standard, texts, scope }),
    media: (references) => screenGalleryMedia(galleryMediaJudge(scope.orgId), references)
  };
}
