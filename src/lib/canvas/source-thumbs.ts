type PostMedia = { items?: unknown; thumbnailUrl?: unknown } | null | undefined;

export function postThumb(post: { media?: PostMedia }): string | null {
  const items = Array.isArray(post.media?.items) ? (post.media.items as { thumbnailUrl?: string | null }[]) : [];
  const cover = post.media?.thumbnailUrl;
  return items[0]?.thumbnailUrl ?? (typeof cover === 'string' ? cover : null);
}

export function productThumb(product: { images: { url: string }[] }): string | null {
  return product.images[0]?.url ?? null;
}
