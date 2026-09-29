<script lang="ts">
  import Rss from '@lucide/svelte/icons/rss';
  import SourcePreview, { type PreviewTile } from './SourcePreview.svelte';
  import { mediaKindOf } from '$lib/canvas/source-filters';
  import type { SocialFeedNode } from '$lib/canvas/social-feed-node';
  import type { SocialPost } from '$lib/server/repos/social-posts';

  let { node, posts = [], total = 0 }: { node: SocialFeedNode; posts?: SocialPost[]; total?: number } = $props();

  const BADGE_OF = { carousel: 'carousel', video: 'video', image: null } as const;

  function thumbOf(post: SocialPost): string | null {
    const items = Array.isArray(post.media?.items) ? (post.media.items as { thumbnailUrl?: string | null; url?: string }[]) : [];
    const cover = post.media?.thumbnailUrl;
    return items[0]?.thumbnailUrl ?? (typeof cover === 'string' ? cover : null);
  }

  const tiles = $derived<PreviewTile[]>(
    posts.map((post) => ({
      key: post.id,
      thumb: thumbOf(post),
      label: post.caption ?? '',
      caption: null,
      badge: BADGE_OF[mediaKindOf(post.media)]
    }))
  );
</script>

<SourcePreview
  icon={Rss}
  title={node.handle.trim() ? `@${node.handle} · ${node.platform}` : 'Feed social'}
  {tiles}
  {total}
  syncStatus={node.syncStatus}
  syncError={node.syncError}
  empty={node.handle.trim() ? 'No posts yet. Sync from the panel on the right.' : 'Choose the account in the panel on the right.'}
/>
