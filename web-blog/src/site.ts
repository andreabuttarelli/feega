import { getCollection, type CollectionEntry } from 'astro:content';

export const SITE_TITLE = 'Feega blog';
export const SITE_DESCRIPTION = 'Notes from building Feega, one open-source canvas for design, motion and AI.';
export const DEFAULT_OG = '/og-default.png';
const WORDS_PER_MINUTE = 220;

export type Post = CollectionEntry<'posts'>;

export async function postsNewestFirst(): Promise<Post[]> {
  const posts = await getCollection('posts');
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function readingMinutes(post: Post): number {
  const words = (post.body ?? '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function tagSlug(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
