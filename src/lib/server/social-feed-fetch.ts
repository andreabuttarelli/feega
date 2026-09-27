import { env } from '$env/dynamic/private';
import { fetchProfileHistory, fetchSinglePost, isSinglePostPlatform, type NormalizedPost } from '$lib/server/scrapecreators';
import { classifySocialInput, type SocialEntry } from '$lib/canvas/social-url-classifier';

/**
 * IL FEED PUBBLICO DI UN ACCOUNT, PER IL NODO `social_account_feed`.
 *
 * `scrapecreators.ts` è già la fonte per i feed social — sopravvissuta alla demolizione con 16
 * importatori — e `fetchProfileHistory` è già la funzione che prende piattaforma + account e torna
 * i post normalizzati. Questo file non la riscrive: le fa da guardia leggibile, perché
 * `fetchProfileHistory` torna `[]` sia per "zero post" sia per "piattaforma sconosciuta" sia per
 * "l'handle non esiste" — tre fatti diversi che un nodo sulla tela deve poter distinguere, non un
 * riquadro vuoto senza perché.
 *
 * `reddit` e `pinterest` sono due piattaforme che `social_account_feed` ammette
 * (`SOCIAL_PLATFORMS` in `node-data.ts`, lo stesso enum di `social_accounts_platform_check`) ma che
 * `scrapecreators.ts::FETCHERS` non copre ancora: un nodo creato su una di queste due deve dirlo,
 * non restare fermo senza spiegazione.
 */
const SUPPORTED_PLATFORMS = ['instagram', 'tiktok', 'x', 'threads', 'facebook', 'youtube', 'linkedin'] as const;

export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

export function isSupportedFeedPlatform(platform: string): platform is SupportedPlatform {
  return (SUPPORTED_PLATFORMS as readonly string[]).includes(platform);
}

export type FetchFeedResult = { ok: true; posts: NormalizedPost[] } | { ok: false; error: string };

export async function fetchSocialFeed(
  platform: string,
  handle: string,
  limit: number
): Promise<FetchFeedResult> {
  if (!isSupportedFeedPlatform(platform)) {
    return { ok: false, error: `unsupported_platform: ${platform} is not wired to ScrapeCreators yet` };
  }
  if (!handle.trim()) {
    return { ok: false, error: 'missing_handle: this feed has no handle to download' };
  }
  if (!env.SCRAPECREATORS_API_KEY) {
    return { ok: false, error: 'not_configured: ScrapeCreators has no API key on this environment' };
  }

  try {
    const posts = await fetchProfileHistory(
      platform,
      { username: handle, profileUrl: null },
      { maxPosts: Math.max(1, limit) }
    );
    if (!posts.length) {
      return { ok: false, error: `no_posts: no public posts found for @${handle} on ${platform} — check the handle` };
    }
    return { ok: true, posts };
  } catch (e) {
    return { ok: false, error: `fetch_failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * UN'ENTRY GIÀ CLASSIFICATA (`social-url-classifier.ts`) → I SUOI POST.
 *
 * `fetchSocialFeed` sopra prende una piattaforma+handle già decisi a mano; questa prende quel che
 * `classifySocialInput` ha capito da solo — un profilo scarica lo storico come prima, un post
 * singolo scarica quell'unico post via `fetchSinglePost`, un hashtag non è ancora cablato e lo
 * dice, non finge un array vuoto.
 */
export async function fetchClassifiedEntry(entry: SocialEntry, limit: number): Promise<FetchFeedResult> {
  if (!env.SCRAPECREATORS_API_KEY) {
    return { ok: false, error: 'not_configured: ScrapeCreators has no API key on this environment' };
  }

  if (entry.kind === 'hashtag') {
    return { ok: false, error: `not_supported: hashtag sync for ${entry.platform} is not wired yet` };
  }

  if (entry.kind === 'post') {
    if (!isSinglePostPlatform(entry.platform)) {
      return { ok: false, error: `unsupported_platform: single-post fetch is not wired for ${entry.platform}` };
    }
    try {
      const post = await fetchSinglePost(entry.platform, entry.source);
      return { ok: true, posts: [post] };
    } catch (e) {
      return { ok: false, error: `fetch_failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  if (!entry.handle) {
    return { ok: false, error: 'missing_handle: this feed has no handle to download' };
  }
  return fetchSocialFeed(entry.platform, entry.handle, limit);
}

export { classifySocialInput };
