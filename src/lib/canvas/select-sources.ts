/**
 * CHE COSA UN ITEM DI `products`/`social_account_feed` DÀ A UN `select` — pura logica di
 * trasformazione, nessun database: chi ha un `db` (`upstream.ts`, lato server) legge le righe
 * sincronizzate e passa qui la forma minima, questo file dice solo come SI LEGGONO, non da dove
 * vengono.
 *
 * UNA TABELLA SOLA, non un `if` per tipo: `PRODUCT_ITEM`/`SOCIAL_POST_ITEM` sotto sono le due
 * righe che dicono, per il rispettivo record sincronizzato, quale testo e quali media porta un
 * item — un prodotto porta titolo+descrizione e le sue foto, un post porta la didascalia e le
 * sue slide. Il chiamante (`upstream.ts::selectSourceItems`) sceglie la riga dal `type` del nodo
 * sorgente, mai una logica propria.
 *
 * UN POST CON PIÙ SLIDE (carosello) DÀ TUTTE LE SUE IMMAGINI, non solo la prima — `media.items`
 * quando presente (l'ordine delle slide), altrimenti `thumbnailUrl`/`videoUrl` come un post a una
 * slide sola. Un `select` che sceglie quel post alimenta un connettore a valore multiplo con ogni
 * slide, la stessa dottrina di `influencer.mediaUrls` in `upstream-inputs.ts`.
 */
export type SelectableItem = {
  text: string | null;
  mediaUrls: string[];
};

type MediaSlide = { type?: string; url?: string; thumbnailUrl?: string };

const stillOf = (slide: MediaSlide): string | undefined =>
  slide.type === 'video' ? slide.thumbnailUrl : (slide.url ?? slide.thumbnailUrl);

function slidesOf(media: Record<string, unknown> | null): string[] {
  if (!media) return [];

  const items = Array.isArray(media.items) ? (media.items as MediaSlide[]) : [];
  if (items.length) {
    return items.map(stillOf).filter((url): url is string => Boolean(url));
  }

  return typeof media.thumbnailUrl === 'string' && media.thumbnailUrl ? [media.thumbnailUrl] : [];
}

export function productItem(product: {
  title: string;
  description: string | null;
  images: Array<{ url: string }>;
}): SelectableItem {
  const text = [product.title, product.description].filter((t): t is string => Boolean(t?.trim())).join('\n\n') || null;
  return { text, mediaUrls: product.images.map((i) => i.url) };
}

export function socialPostItem(post: { caption: string | null; media: Record<string, unknown> | null }): SelectableItem {
  return { text: post.caption?.trim() ? post.caption : null, mediaUrls: slidesOf(post.media) };
}
