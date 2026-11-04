import { libsOrigin } from '$lib/server/motion/libs-origin';
import { importUrlInto, type UrlScope } from '$lib/server/url-import/canvas-import';
import { assertPublicUrl } from '$lib/server/tool-guard';
import { UrlImportOutcome, type UrlImported } from '$lib/server/url-import/import-url';
import { Sectioning, Tokening } from '$lib/server/url-import/url-doc';

export const PREVIEW_PATH = '/components/preview';

export type ComponentAsk = { registryUrl: string; props?: Record<string, unknown>; at: { x: number; y: number } };

export function previewUrl(registryUrl: string, props: Record<string, unknown> = {}): string {
  const url = new URL(PREVIEW_PATH, libsOrigin());
  url.searchParams.set('registry', registryUrl);
  url.searchParams.set('props', JSON.stringify(props));
  return url.toString();
}

const ownPreview = async (url: URL) => {
  if (url.origin !== new URL(libsOrigin()).origin || url.pathname !== PREVIEW_PATH) {
    throw new Error('not a component preview');
  }
};

export async function insertComponentInto(scope: UrlScope, canvasId: string, ask: ComponentAsk): Promise<UrlImported> {
  const registry = await assertPublicUrl(new URL(ask.registryUrl)).then(
    () => true,
    () => false
  );
  if (!registry) {
    return { outcome: UrlImportOutcome.NotPublic };
  }
  return importUrlInto(scope, canvasId, {
    url: previewUrl(ask.registryUrl, ask.props),
    at: ask.at,
    shape: { sectioning: Sectioning.Off, tokening: Tokening.On },
    views: [],
    guard: ownPreview
  });
}
