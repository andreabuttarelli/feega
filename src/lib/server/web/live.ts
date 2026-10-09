import { env } from '$env/dynamic/private';
import type { Db } from '$lib/server/db/client';
import { logAiCall, withBrandContext, withOrgContext } from '$lib/server/ai-log';
import { SCRAPECREATORS_COST_USD, scrapeCreatorsGet } from '$lib/server/scrapecreators';
import { llmApiKey, llmBaseUrl, llmDefaultModel } from '$lib/server/llm';
import { safeFetchBytes } from '$lib/server/tool-guard';
import { chromiumPage, serverFramesOpen } from '$lib/server/motion/chromium-frames';
import { ATTACHMENT_PORTS, inlineAttachment } from '$lib/server/chat-attachments/register';
import { CHAT_ATTACHMENT_MAX_BYTES } from '$lib/chat-attachments';
import type { ProjectMode } from '$lib/project-mode';
import { SearchEngine, exaSearch, openRouterSearch, searchEngineOf, type SearchPort } from './search';
import { readPage } from './read-page';
import { browserless, localBrowser, type BrowserlessUse, type OpenBrowser } from './browser';
import { browse } from './browse';
import { directFetch, exaContents, renderedSite, secondarySources, type SiteStrategy } from './site-fetch';
import { screenshotPage } from './screenshot';
import { readStore, storeProducts } from './store';
import { viewImages, type ViewPorts } from './view-images';
import { pinterestBoard, pinterestPin, pinterestSearch, type PinterestGet, type PinsFound } from './pinterest';
import { canvasUploadPrefix } from '$lib/canvas/upload-kind';
import { removeAssetFile, signAssetFile, storeAssetFile } from '$lib/server/repos/asset-storage';
import type { FetchedProduct, StorePlatform } from '$lib/server/store-fetch';
import { createNode } from '$lib/server/repos/canvas';
import { upsertNodeProducts } from '$lib/server/repos/products';
import type { Actor } from '$lib/server/repos/actor';
import type { ScreenOutcome } from '$lib/server/moderation/screen';
import type { AssetImport } from '$lib/server/motion/motion-tools';
import type { MotionAsset } from '$lib/server/motion/editor';
import type { ImageImport, PinterestPort, PinterestRead, ProductsImport, WebToolDeps } from './web-tools';

export type WebScope = { orgId: string; userId: string; projectId: string; brandId?: string | null; mode: ProjectMode };

export const WEB_VIEWS_DIR = 'web-views';

const IMAGE_TIMEOUT_MS = 20_000;
const SEARCH_LABEL = 'web-search';
const PICTURES_PER_PRODUCT = 2;
const VIEW_MAX_BYTES = 15_000_000;
const BROWSERLESS_LABEL = 'browserless';
const BROWSERLESS_MODEL = 'stealth';
const EXA_CONTENTS_LABEL = 'site-read-exa';

const ENGINES: Record<SearchEngine, () => { port: SearchPort; provider: 'exa' | 'llm'; model: string }> = {
  [SearchEngine.Exa]: () => ({ port: exaSearch(env.EXA_API_KEY!.trim()), provider: 'exa', model: 'exa-search' }),
  [SearchEngine.Gateway]: () => {
    const model = llmDefaultModel();
    return { port: openRouterSearch({ baseUrl: llmBaseUrl(), apiKey: llmApiKey() ?? '', model }), provider: 'llm', model: `${model}+web` };
  }
};

export function loggedSearch(scope: Omit<WebScope, 'mode'>, engine: SearchEngine = searchEngineOf(env)): SearchPort {
  return async (query, max) => {
    const { port, provider, model } = ENGINES[engine]();
    const t0 = Date.now();
    const found = await port(query, max);
    logAiCall({
      label: SEARCH_LABEL,
      provider,
      model,
      prompt: query,
      ms: Date.now() - t0,
      ok: found.ok,
      ...(found.ok ? { flatCostUsd: found.costUsd } : { error: found.error }),
      orgId: scope.orgId,
      brandId: scope.brandId ?? undefined,
      userId: scope.userId,
      projectId: scope.projectId,
      actorKind: 'agent',
      actorId: scope.userId
    });
    return found;
  };
}

export function webImageImport(db: Db, scope: { orgId: string; projectId: string; mode: ProjectMode }): (url: string) => Promise<ImageImport> {
  return async (url) => {
    try {
      const fetched = await safeFetchBytes(url, { maxBytes: CHAT_ATTACHMENT_MAX_BYTES, timeoutMs: IMAGE_TIMEOUT_MS, scheme: 'https-only' });
      if (!fetched.ok || !fetched.mime.startsWith('image/')) {
        return { ok: false, error: fetched.ok ? `not a picture (${fetched.mime || 'unknown type'})` : `the server answered ${fetched.status}` };
      }
      const name = decodeURIComponent(new URL(fetched.url).pathname.split('/').pop() || 'image');
      const saved = await inlineAttachment(db, scope, { data: fetched.bytes.toString('base64'), name, mimeType: fetched.mime }, ATTACHMENT_PORTS);
      return { ok: true, assetId: saved.assetId, width: null, height: null };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };
}

export function webViewPrefix(scope: { orgId: string; projectId: string }, callId: string): string {
  return `${canvasUploadPrefix(scope.orgId, scope.projectId)}${WEB_VIEWS_DIR}/${callId}`;
}

function viewer(db: Db, scope: WebScope): NonNullable<WebToolDeps['view']> {
  const ports: ViewPorts = {
    fetchImage: (url) => safeFetchBytes(url, { maxBytes: VIEW_MAX_BYTES, timeoutMs: IMAGE_TIMEOUT_MS }),
    store: (path, bytes) => storeAssetFile(db, path, new File([new Uint8Array(bytes)], path.split('/').at(-1) as string, { type: 'image/jpeg' })),
    screen: async (path) => ATTACHMENT_PORTS.screenImage({ orgId: scope.orgId, mode: scope.mode, url: await signAssetFile(db, path) }),
    remove: (path) => removeAssetFile(db, path)
  };
  return (urls, detail, callId) => viewImages(urls, detail, webViewPrefix(scope, callId), ports);
}

type Metered = Omit<WebScope, 'mode'>;

function logged(scope: Metered, entry: { label: string; provider: 'browserless' | 'exa'; model: string; ms: number; usd: number; units?: number }) {
  logAiCall({
    label: entry.label,
    provider: entry.provider,
    model: entry.model,
    ms: entry.ms,
    ok: true,
    flatCostUsd: entry.usd,
    ...(entry.units ? { providerCredits: entry.units } : {}),
    orgId: scope.orgId,
    brandId: scope.brandId ?? undefined,
    userId: scope.userId,
    projectId: scope.projectId,
    actorKind: 'agent',
    actorId: scope.userId
  });
}

async function connectBrowserless(endpoint: string) {
  const { default: puppeteer } = await import('puppeteer-core');
  return puppeteer.connect({ browserWSEndpoint: endpoint });
}

export function liveBrowser(scope: Metered): OpenBrowser | null {
  const key = env.BROWSERLESS_API_KEY?.trim();
  if (key) {
    const meter = (use: BrowserlessUse) => logged(scope, { label: BROWSERLESS_LABEL, provider: 'browserless', model: BROWSERLESS_MODEL, ms: use.ms, usd: use.usd, units: use.units });
    return browserless({ key, base: env.BROWSERLESS_BASE_URL?.trim() || undefined }, { connect: connectBrowserless, meter });
  }
  return serverFramesOpen() ? localBrowser(() => chromiumPage()) : null;
}

function meteredExa(scope: Metered, key: string): SiteStrategy {
  const strategy = exaContents(key);
  return {
    ...strategy,
    get: async (url) => {
      const started = Date.now();
      const got = await strategy.get(url);
      if (got.costUsd) {
        logged(scope, { label: EXA_CONTENTS_LABEL, provider: 'exa', model: 'exa-contents', ms: Date.now() - started, usd: got.costUsd });
      }
      return got;
    }
  };
}

export function liveSiteChain(scope: Metered): SiteStrategy[] {
  const browser = liveBrowser(scope);
  const exaKey = env.EXA_API_KEY?.trim();
  return [
    directFetch(),
    ...(browser ? [renderedSite(browser)] : []),
    ...(exaKey ? [meteredExa(scope, exaKey), secondarySources(loggedSearch(scope, SearchEngine.Exa), (url) => readPage(url))] : [])
  ];
}

function browser(db: Db, scope: WebScope, open: OpenBrowser): NonNullable<WebToolDeps['browse']> {
  return async (url, steps, callId) => {
    const seen = await browse(url, steps, open);
    if (!seen.ok) {
      return seen;
    }
    const prefix = webViewPrefix(scope, callId);
    const shots = await Promise.all(
      seen.shots.map(async (jpeg, i) => {
        const path = `${prefix}/browse-${i}.jpg`;
        const stored = await storeAssetFile(db, path, new File([new Uint8Array(jpeg)], `browse-${i}.jpg`, { type: 'image/jpeg' })).then(
          () => path,
          () => null
        );
        return { jpeg, path: stored };
      })
    );
    return { ...seen, shots };
  };
}

const priced = (found: PinsFound): PinterestRead => ({ ...found, costUsd: found.requests * SCRAPECREATORS_COST_USD });

export function pinterestPort(get: PinterestGet): PinterestPort {
  return {
    search: async (query, limit) => priced(await pinterestSearch(get, query, limit)),
    pin: async (url) => priced(await pinterestPin(get, url)),
    board: async (url, limit) => priced(await pinterestBoard(get, url, limit))
  };
}

function livePinterest(scope: Metered): PinterestPort | undefined {
  if (!env.SCRAPECREATORS_API_KEY?.trim()) {
    return undefined;
  }
  const billed = <T>(fn: () => T): T => (scope.brandId ? withBrandContext(scope.brandId, fn) : withOrgContext(scope.orgId, fn));
  return pinterestPort((path) => billed(() => scrapeCreatorsGet(path)));
}

export function liveWebDeps(db: Db, scope: WebScope, spend: (usd: number) => void): WebToolDeps {
  const open = liveBrowser(scope);
  return {
    view: viewer(db, scope),
    search: loggedSearch(scope),
    read: (url) => readPage(url),
    store: (url, opts) => readStore(url, opts),
    shoot: serverFramesOpen() ? (url, view) => screenshotPage(url, view, chromiumPage) : undefined,
    browse: open ? browser(db, scope, open) : undefined,
    pinterest: livePinterest(scope),
    spend
  };
}

type SavePicture = (url: string) => Promise<ImageImport>;
type PlaceProducts = (platform: StorePlatform, storeUrl: string, products: FetchedProduct[]) => Promise<string | null>;

export function productImport(save: SavePicture, place?: PlaceProducts, fetchProducts = storeProducts): (storeUrl: string, handles: string[]) => Promise<ProductsImport> {
  return async (storeUrl, handles) => {
    const found = await fetchProducts(storeUrl, handles);
    if (!found.ok) {
      return found;
    }
    const products = await Promise.all(
      found.products.map(async (p) => {
        const saved = await Promise.all(p.images.slice(0, PICTURES_PER_PRODUCT).map((i) => save(i.url)));
        return { handle: p.handle ?? p.title, title: p.title, asset_ids: saved.flatMap((s) => (s.ok ? [s.assetId] : [])), pictures: p.images.slice(0, PICTURES_PER_PRODUCT).flatMap((i, n) => (saved[n].ok ? [i.url] : [])) };
      })
    );
    const nodeId = place && found.products.length ? await place(found.platform, storeUrl, found.products) : null;
    return { ok: true, products, missing: found.missing, ...(nodeId ? { node_id: nodeId } : {}) };
  };
}

export function productsNodePlacer(db: Db, scope: { orgId: string; projectId: string; canvasId: string; actor: Actor }): PlaceProducts {
  return async (platform, storeUrl, products) => {
    const url = new URL(/^https?:\/\//i.test(storeUrl) ? storeUrl : `https://${storeUrl}`).origin;
    const node = await createNode(db, { ...scope, type: 'products', x: 0, y: 0, data: { type: platform, url, limit: products.length } });
    await upsertNodeProducts(db, { orgId: scope.orgId, projectId: scope.projectId, nodeId: node.id, platform, products });
    return node.id;
  };
}

export function screenedImport(importAsset: (url: string) => Promise<AssetImport>, screen: (url: string) => Promise<ScreenOutcome>, assets: MotionAsset[]): SavePicture {
  return async (url) => {
    const review = await screen(url);
    if (!review.ok) {
      return { ok: false, error: review.error };
    }
    const imported = await importAsset(url);
    if (!imported.ok) {
      return imported;
    }
    assets.push(imported.asset);
    return { ok: true, assetId: imported.asset.id, width: imported.width, height: imported.height };
  };
}
