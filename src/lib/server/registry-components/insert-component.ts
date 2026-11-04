import { libsOrigin } from '$lib/server/motion/libs-origin';
import { importUrlInto, type UrlScope } from '$lib/server/url-import/canvas-import';
import { assertPublicUrl } from '$lib/server/tool-guard';
import { UrlImportOutcome, type UrlImported } from '$lib/server/url-import/import-url';
import { Sectioning, Tokening } from '$lib/server/url-import/url-doc';
import { frameStore, MoveOutcome } from '$lib/server/motion/move-element';
import { libraryOf } from './registry-item';
import { landInFrame, type FrameSpot } from './land-component';

export const PREVIEW_PATH = '/components/preview';

export type ComponentAsk = { registryUrl: string; props?: Record<string, unknown>; at: { x: number; y: number }; into?: FrameSpot };

export type ComponentInserted = UrlImported | { outcome: UrlImportOutcome.Ok; frameId: string; elementId: string; landed: true } | { outcome: UrlImportOutcome.Rejected; error: string };

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

export async function insertComponentInto(scope: UrlScope, canvasId: string, ask: ComponentAsk): Promise<ComponentInserted> {
  const registry = await assertPublicUrl(new URL(ask.registryUrl)).then(
    () => true,
    () => false
  );
  if (!registry) {
    return { outcome: UrlImportOutcome.NotPublic };
  }

  const imported = await importUrlInto(scope, canvasId, {
    url: previewUrl(ask.registryUrl, ask.props),
    at: ask.at,
    shape: { sectioning: Sectioning.Off, tokening: Tokening.On, site: libraryOf(ask.registryUrl) },
    views: [],
    guard: ownPreview
  });
  if (imported.outcome !== UrlImportOutcome.Ok || !ask.into) {
    return imported;
  }

  const landed = await landInFrame(frameStore(scope.db, { orgId: scope.orgId, actor: scope.actor, projectId: scope.projectId }), imported.frameId, ask.into);
  if (landed.outcome !== MoveOutcome.Done) {
    return { outcome: UrlImportOutcome.Rejected, error: landed.detail ?? landed.outcome };
  }
  return { outcome: UrlImportOutcome.Ok, frameId: landed.frameId, elementId: landed.clipId, landed: true };
}
