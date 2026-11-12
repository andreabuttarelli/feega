import type { Post } from './post';
import { CANVAS_FAST } from './canvas-fast';

export const POSTS: Readonly<Record<string, Post>> = {
  'how-the-canvas-got-fast': CANVAS_FAST
};

export const postPath = (slug: string) => `/blog/${slug}`;

export const isPostSlug = (slug: string) => Object.hasOwn(POSTS, slug);
