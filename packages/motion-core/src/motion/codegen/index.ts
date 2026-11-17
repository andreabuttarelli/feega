import type { BrandTokens } from '../brand';
import { everyClip, type MotionDoc } from '../doc';
import { FillType, fillsOf } from '../fill/model';
import { withAutoLayout } from '../layout/resolve';
import { buildPage } from './build';
import { withMedia } from './media';
import { resolveAt, shownOnlyIn, viewsOf } from '../breakpoints/model';
import type { MotionClip } from '../doc';
import type { PageSpec } from './ir';
import { CodeTarget, type CodeAsset, type CodeExport, type CodeFile } from './model';
import { fontAssetIds } from './fonts';
import { kebab } from './naming';
import { htmlProject } from './targets/html';
import { reactProject } from './targets/react';
import { svelteProject } from './targets/svelte';

export { CodeTarget, CODE_TARGETS, type CodeAsset, type CodeExport, type CodeFile } from './model';

type TargetSpec = { label: string; stack: string; publicDir: string; assetBase: string; project: (page: PageSpec, slug: string) => CodeFile[] };

export const TARGETS: Record<CodeTarget, TargetSpec> = {
  [CodeTarget.React]: { label: 'React', stack: 'React + Tailwind', publicDir: 'public/', assetBase: '/assets/', project: reactProject },
  [CodeTarget.Html]: { label: 'HTML', stack: 'HTML + CSS', publicDir: '', assetBase: 'assets/', project: (page) => htmlProject(page) },
  [CodeTarget.Svelte]: { label: 'Svelte', stack: 'SvelteKit', publicDir: 'static/', assetBase: '/assets/', project: svelteProject }
};

export const DEFAULT_TARGET = CodeTarget.React;

export type ExportOptions = { target?: CodeTarget; name?: string; assets?: Record<string, string>; brand?: BrandTokens | null };

const DEFAULT_NAME = 'Page';

const byPath = (a: CodeFile, b: CodeFile) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

export function exportCode(doc: MotionDoc, options: ExportOptions = {}): CodeExport {
  const target = options.target ?? DEFAULT_TARGET;
  const name = options.name?.trim() || DEFAULT_NAME;
  const spec = TARGETS[target];
  const build = (at: MotionDoc) => buildPage({ doc: withAutoLayout(at), name, assets: options.assets ?? {}, assetBase: spec.assetBase, brand: options.brand ?? null });
  const views = viewsOf(doc)
    .slice(1)
    .map((v) => ({ maxWidth: v.width, page: build(resolveAt(doc, v.id)) }));
  const deferred = viewOnlyClips(doc);
  const page = withMedia(build(withViewOnlyShown(doc, deferred)), views, doc.width, deferred);
  const files = spec.project(page, kebab(name)).sort(byPath);
  return { target, files, assets: bundled(page, spec), notes: page.notes };
}

function viewOnlyClips(doc: MotionDoc): Set<string> {
  return new Set(everyClip(doc).filter((c) => shownOnlyIn(c).length).map((c) => c.id));
}

function withViewOnlyShown(doc: MotionDoc, ids: ReadonlySet<string>): MotionDoc {
  if (!ids.size) {
    return doc;
  }
  const show = (c: MotionClip) => (ids.has(c.id) ? { ...c, hidden: false } : c);
  const tracks = (ts: MotionDoc['tracks']) => ts.map((t) => ({ ...t, clips: t.clips.map((c) => show(c as MotionClip)) })) as MotionDoc['tracks'];
  const comps = doc.comps ? Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, { ...comp, tracks: tracks(comp.tracks) }])) : doc.comps;
  return { ...doc, tracks: tracks(doc.tracks), comps } as MotionDoc;
}

function bundled(page: PageSpec, spec: TargetSpec): CodeAsset[] {
  return page.assets.flatMap(({ url, ref }) => (url ? [{ path: `${spec.publicDir}${ref.replace(/^\//, '')}`, ref, url }] : []));
}

export function codeAssetIds(doc: MotionDoc): string[] {
  const ids = everyClip(doc).flatMap((clip) => {
    const own = typeof clip.props.assetId === 'string' ? [clip.props.assetId] : [];
    const filled = Array.isArray(clip.props.fills) ? fillsOf(clip.props).flatMap((f) => (f.type === FillType.Image && f.assetId ? [f.assetId] : [])) : [];
    return [...own, ...filled];
  });
  return [...new Set([...ids, ...fontAssetIds(doc)])].sort();
}
