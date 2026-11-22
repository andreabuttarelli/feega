import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const entrySchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  archived: z.boolean().default(false),
  cover: z.string(),
  coverAlt: z.string(),
  tags: z.array(z.string()).default([]),
  author: z.string().default('Andrea Buttarelli')
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: entrySchema
});

const usecases = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/usecases' }),
  schema: entrySchema
});

export const collections = { posts, usecases };
