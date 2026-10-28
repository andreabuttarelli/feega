import type { BrandTokens } from '../brand';
import { everyClip, type MotionDoc } from '../doc';
import { FillType, fillsOf } from '../fill/model';
import { withAutoLayout } from '../layout/resolve';
import { buildPage } from './build';
import { withMedia } from './media';
import { resolveAt, viewsOf } from '../breakpoints/model';
import type { PageSpec } from './ir';
import { CodeTarget, type CodeExport, type CodeFile } from './model';
import { kebab } from './naming';
import { htmlProject } from './targets/html';
import { reactProject } from './targets/react';
import { svelteProject } from './targets/svelte';

export { CodeTarget, CODE_TARGETS, type CodeExport, type CodeFile } from './model';

type TargetSpec = { label: string; stack: string; project: (page: PageSpec, slug: string) => CodeFile[] };

export const TARGETS: Record<CodeTarget, TargetSpec> = {
  [CodeTarget.React]: { label: 'React', stack: 'React + Tailwind', project: reactProject },
  [CodeTarget.Html]: { label: 'HTML', stack: 'HTML + CSS', project: (page) => htmlProject(page) },
  [CodeTarget.Svelte]: { label: 'Svelte', stack: 'SvelteKit', project: svelteProject }
};

export const DEFAULT_TARGET = CodeTarget.React;

export type ExportOptions = { target?: CodeTarget; name?: string; assets?: Record<string, string>; brand?: BrandTokens | null };

const DEFAULT_NAME = 'Page';

const byPath = (a: CodeFile, b: CodeFile) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

export function exportCode(doc: MotionDoc, options: ExportOptions = {}): CodeExport {
  const target = options.target ?? DEFAULT_TARGET;
  const name = options.name?.trim() || DEFAULT_NAME;
  const build = (at: MotionDoc) => buildPage({ doc: withAutoLayout(at), name, assets: options.assets ?? {}, brand: options.brand ?? null });
  const views = viewsOf(doc)
    .slice(1)
    .map((v) => ({ maxWidth: v.width, page: build(resolveAt(doc, v.id)) }));
  const page = withMedia(build(doc), views);
  const files = TARGETS[target].project(page, kebab(name)).sort(byPath);
  return { target, files, notes: page.notes };
}

export function codeAssetIds(doc: MotionDoc): string[] {
  const ids = everyClip(doc).flatMap((clip) => {
    const own = typeof clip.props.assetId === 'string' ? [clip.props.assetId] : [];
    const filled = Array.isArray(clip.props.fills) ? fillsOf(clip.props).flatMap((f) => (f.type === FillType.Image && f.assetId ? [f.assetId] : [])) : [];
    return [...own, ...filled];
  });
  return [...new Set(ids)].sort();
}
