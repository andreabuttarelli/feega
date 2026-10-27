import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { setProps, type OpResult } from '@feega/motion-core/motion/timeline';
import { FontCategory, FontSource, isBuiltin, searchFonts, usedFaces, variantsOf, type CatalogueFont, type FontFace, type FontVariant } from '@feega/motion-core/motion/fonts/model';

const fail = (error: string): OpResult => ({ ok: false, error });

const SUGGESTIONS = 5;
const SUGGEST_PREFIX = 4;
const CATEGORIES = new Set<string>(Object.values(FontCategory));

export type FontChoice = { family: string; weight?: number; italic?: boolean };

function googleFace(entry: CatalogueFont): FontFace {
  return { family: entry.f, source: FontSource.Google, category: (CATEGORIES.has(entry.c) ? entry.c : FontCategory.Sans) as FontCategory, weights: entry.w, italic: entry.i === 1, axes: entry.a ?? [] };
}

function registered(doc: MotionDoc, family: string, catalogue: readonly CatalogueFont[]): { doc: MotionDoc; face: FontFace | null } | string {
  if (isBuiltin(family)) {
    return { doc, face: null };
  }
  const known = doc.fonts.find((f) => f.family === family);
  if (known) {
    return { doc, face: known };
  }
  const entry = catalogue.find((f) => f.f.toLowerCase() === family.toLowerCase());
  if (!entry) {
    const close = searchFonts(catalogue, family.slice(0, SUGGEST_PREFIX), [], SUGGESTIONS).map((f) => f.f);
    return `no Google font "${family}"${close.length ? `; close: ${close.join(', ')}` : ''}. Upload a font file to use one outside Google Fonts.`;
  }
  const face = googleFace(entry);
  return { doc: { ...doc, fonts: [...doc.fonts, face] }, face };
}

export function setFont(doc: MotionDoc, clipId: string, choice: FontChoice, catalogue: readonly CatalogueFont[]): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }
  if (!('font' in found.clip.props)) {
    return fail(`${found.clip.component} has no text font; custom components take a font param through set_props after register_font`);
  }
  const verdict = registered(doc, choice.family, catalogue);
  if (typeof verdict === 'string') {
    return fail(verdict);
  }
  const family = verdict.face?.family ?? choice.family;
  if (choice.italic && verdict.face && !verdict.face.italic) {
    return fail(`${family} has no italic`);
  }
  return setProps(verdict.doc, clipId, { font: family, ...(choice.weight === undefined ? {} : { weight: choice.weight }), ...(choice.italic === undefined ? {} : { italic: choice.italic }) });
}

export function registerFont(doc: MotionDoc, family: string, catalogue: readonly CatalogueFont[]): OpResult {
  const verdict = registered(doc, family, catalogue);
  return typeof verdict === 'string' ? fail(verdict) : { ok: true, doc: verdict.doc };
}

export function registerUpload(doc: MotionDoc, family: { family: string; variants: FontVariant[] }): OpResult {
  const known = doc.fonts.find((f) => f.family === family.family);
  if (isBuiltin(family.family) || (known && known.source !== FontSource.Upload)) {
    return fail(`a font named ${family.family} is already in this video`);
  }
  if (!family.variants.length) {
    return fail(`${family.family} has no files`);
  }
  const weights = [...new Set(family.variants.map((v) => v.weight))].sort((a, b) => a - b);
  const face: FontFace = { family: family.family, source: FontSource.Upload, category: FontCategory.Sans, weights, italic: family.variants.some((v) => v.italic), axes: [], assetId: family.variants[0].assetId, variants: family.variants };
  const listed = new Set(doc.assets.map((a) => a.id));
  const added = family.variants.filter((v) => !listed.has(v.assetId)).map((v) => ({ id: v.assetId, kind: 'font' as const, name: family.family }));
  const fonts = known ? doc.fonts.map((f) => (f === known ? face : f)) : [...doc.fonts, face];
  return { ok: true, doc: { ...doc, fonts, assets: [...doc.assets, ...added] } };
}

export function withUploaded(doc: MotionDoc, family: string, uploaded: readonly { family: string; variants: FontVariant[] }[]): { doc: MotionDoc; family: string } {
  const match = uploaded.find((f) => f.family.toLowerCase() === family.toLowerCase());
  const registered = match ? registerUpload(doc, match) : null;
  return registered?.ok ? { doc: registered.doc, family: match!.family } : { doc, family };
}

export function removeFont(doc: MotionDoc, family: string): OpResult {
  const face = doc.fonts.find((f) => f.family === family);
  if (!face) {
    return fail(`no font ${family} in this video`);
  }
  const users = doc.tracks.flatMap((t) => t.clips).filter((c) => usedFaces({ ...doc, tracks: [{ clips: [c] }] }).some((f) => f.family === family));
  if (users.length) {
    return fail(`${family} is used by ${users.map((c) => c.id).join(', ')}: change their font first`);
  }
  return { ok: true, doc: { ...doc, fonts: doc.fonts.filter((f) => f.family !== family), assets: doc.assets.filter((a) => !variantsOf(face).some((v) => v.assetId === a.id)) } };
}

const swapped = (props: Record<string, unknown>, from: string, to: string): Record<string, unknown> => {
  const runs = Array.isArray(props.runs) ? (props.runs as { font?: string }[]).map((r) => (r.font === from ? { ...r, font: to } : r)) : props.runs;
  return { ...props, ...(props.font === from ? { font: to } : {}), ...(runs === undefined ? {} : { runs }) };
};

type Tracked = { tracks: { clips: { props: Record<string, unknown> }[] }[] };

const swappedTracks = <T extends Tracked>(owner: T, from: string, to: string): T => ({ ...owner, tracks: owner.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, props: swapped(c.props, from, to) })) })) });

export function replaceFont(doc: MotionDoc, from: string, to: string, catalogue: readonly CatalogueFont[]): OpResult {
  const verdict = registered(doc, to, catalogue);
  if (typeof verdict === 'string') {
    return fail(verdict);
  }
  const family = verdict.face?.family ?? to;
  const comps = Object.fromEntries(Object.entries(verdict.doc.comps).map(([id, comp]) => [id, swappedTracks(comp as never, from, family)]));
  const moved = { ...swappedTracks(verdict.doc, from, family), comps } as MotionDoc;
  const old = moved.fonts.find((f) => f.family === from);
  return old ? removeFont(moved, from) : { ok: true, doc: moved };
}
