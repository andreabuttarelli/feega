import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { postsNewestFirst, SITE_TITLE, SITE_DESCRIPTION } from '../site';

export async function GET(context: APIContext) {
  const posts = await postsNewestFirst();
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/posts/${post.id}/`,
      categories: post.data.tags
    }))
  });
}
