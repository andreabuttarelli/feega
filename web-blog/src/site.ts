import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';

export const SITE_TITLE = 'Feega blog';
export const SITE_DESCRIPTION = 'Notes from building Feega, the free, open-source VS Code extension to design in your codebase.';

const OG_IMAGE_FILE = resolve(process.cwd(), '../landing/static/og.png');
const VERSION_LENGTH = 8;
const OG_IMAGE_VERSION = createHash('sha256').update(readFileSync(OG_IMAGE_FILE)).digest('hex').slice(0, VERSION_LENGTH);

export const SOCIAL_PREVIEW = {
  image: `https://www.feega.app/og.png?v=${OG_IMAGE_VERSION}`,
  video: 'https://www.feega.app/og.mp4',
  alt: 'Feega: Design in your codebase. The Feega logo top left, a free and open source chip top right, and a large screenshot of the editor below with the Layers panel, a heading selected in the app and the Properties panel.',
  width: 1200,
  height: 630
} as const;
const WORDS_PER_MINUTE = 220;

export type Post = CollectionEntry<'posts'>;
export type UseCase = CollectionEntry<'usecases'>;
export type Entry = Post | UseCase;

export type Section = 'posts' | 'use-cases';

export const SECTIONS: Record<Section, { path: string; label: string; indexTitle: string }> = {
  posts: { path: '/posts/', label: 'posts', indexTitle: 'blog' },
  'use-cases': { path: '/use-cases/', label: 'use cases', indexTitle: 'use cases' }
};

function newestFirst<T extends Entry>(entries: T[]): T[] {
  return entries.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

const isCurrent = (entry: Entry): boolean => !entry.data.archived;

export const CURRENT_FEEGA_URL = 'https://www.feega.app';

export const ARCHIVED_BANNER = 'This post describes an earlier version of Feega that no longer exists.';

export async function allPosts(): Promise<Post[]> {
  return newestFirst(await getCollection('posts'));
}

export async function postsNewestFirst(): Promise<Post[]> {
  return newestFirst(await getCollection('posts', isCurrent));
}

export async function useCasesNewestFirst(): Promise<UseCase[]> {
  return newestFirst(await getCollection('usecases', isCurrent));
}

export async function allNewestFirst(): Promise<Entry[]> {
  return newestFirst([...(await getCollection('posts', isCurrent)), ...(await getCollection('usecases', isCurrent))]);
}

export function sectionOf(entry: Entry): Section {
  return entry.collection === 'usecases' ? 'use-cases' : 'posts';
}

export function readingMinutes(entry: Entry): number {
  const words = (entry.body ?? '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function tagSlug(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
