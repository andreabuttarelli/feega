import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    cover: z.string(),
    coverAlt: z.string(),
    tags: z.array(z.string()).default([]),
    author: z.string().default('Andrea Buttarelli')
  })
});

export const collections = { posts };
