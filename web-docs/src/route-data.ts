import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { COVER_HEIGHT, COVER_WIDTH, coverUrl } from './docs-pages.mjs';

export const onRequest = defineRouteMiddleware((context) => {
  const { head, id } = context.locals.starlightRoute;
  const image = new URL(coverUrl(id, 'png'), context.site).href;

  head.push(
    { tag: 'meta', attrs: { property: 'og:image', content: image } },
    { tag: 'meta', attrs: { property: 'og:image:type', content: 'image/png' } },
    { tag: 'meta', attrs: { property: 'og:image:width', content: String(COVER_WIDTH) } },
    { tag: 'meta', attrs: { property: 'og:image:height', content: String(COVER_HEIGHT) } },
    { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
    { tag: 'meta', attrs: { name: 'twitter:image', content: image } }
  );
});
