import { INSTALL_GUIDE_URL, RELEASES_API_URL, isMobile, pickMacDownload, wantedArch, type ReleaseSummary } from '$lib/site/mac-download';

const CACHE_CONTROL = 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600';
const FOUND = 302;

async function loadReleases(fetcher: typeof fetch): Promise<ReleaseSummary[]> {
  try {
    const res = await fetcher(RELEASES_API_URL, { headers: { accept: 'application/vnd.github+json' } });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

function redirect(location: string): Response {
  return new Response(null, { status: FOUND, headers: { location, 'cache-control': CACHE_CONTROL, vary: 'user-agent, sec-ch-ua-arch' } });
}

export async function GET({ request, url, fetch }: { request: Request; url: URL; fetch: typeof globalThis.fetch }): Promise<Response> {
  if (isMobile(request.headers.get('user-agent') ?? '')) {
    return redirect(INSTALL_GUIDE_URL);
  }

  const arch = wantedArch(url.searchParams.get('arch'), request.headers.get('sec-ch-ua-arch'));
  return redirect(pickMacDownload(await loadReleases(fetch), { arch }));
}
