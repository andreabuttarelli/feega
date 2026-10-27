import { z } from 'zod';
import type { BrandEndpoint } from './index';

export const GET_BRAND_LIBRARY = {
  tool: 'get_brand_library',
  title: 'Brand library',
  description:
    'What a designer drags from the canvas Brands panel, one tab at a time: kit (logo variants, palette swatches, fonts, voice rules, approved assets), products (title, ' +
    'price, image), posts (the brand\'s recent posts, then its scraped social posts ranked by ' +
    'engagement) or ads (competitor ads tracked for the brand). Every item with media carries ' +
    'the asset id a canvas node can show. Free, read only.',
  method: 'GET',
  pathUnderBrand: '/library',
  input: z.object({ tab: z.enum(['kit', 'products', 'posts', 'ads']).describe('Which list to read') }).strict(),
  output: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        subtitle: z.string().nullable(),
        assetId: z.string().nullable(),
        mediaType: z.enum(['image', 'video']).nullable(),
        group: z.string().optional()
      })
    )
  }),
  failures: [{ error: 'unknown_tab', status: 400 }],
  destructive: false
} satisfies BrandEndpoint;
