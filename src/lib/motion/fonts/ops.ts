import { findClip, type MotionDoc } from '../doc';
import { setProps, type OpResult } from '../timeline';
import { FontCategory, FontSource, isBuiltin, searchFonts, usedFaces, type CatalogueFont, type FontFace } from './model';

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

export function registerUpload(doc: MotionDoc, input: { assetId: string; family: string; weights: number[]; italic: boolean }): OpResult {
  if (isBuiltin(input.family) || doc.fonts.some((f) => f.family === input.family)) {
    return fail(`a font named ${input.family} is already in this video`);
  }
  const face: FontFace = { family: input.family, source: FontSource.Upload, category: FontCategory.Sans, weights: input.weights, italic: input.italic, axes: [], assetId: input.assetId };
  const assets = doc.assets.some((a) => a.id === input.assetId) ? doc.assets : [...doc.assets, { id: input.assetId, kind: 'font' as const, name: input.family }];
  return { ok: true, doc: { ...doc, fonts: [...doc.fonts, face], assets } };
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
  return { ok: true, doc: { ...doc, fonts: doc.fonts.filter((f) => f.family !== family), assets: doc.assets.filter((a) => a.id !== face.assetId) } };
}
