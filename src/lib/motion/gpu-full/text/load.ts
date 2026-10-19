import { googleFontsUrl, uploadFaceCss, usedFaces } from '../../fonts/model';
import type { MotionDoc } from '../../doc';
import type { FaceBook } from './face';
import { faceBook, faceRules, type FaceRule, type Source } from './fonts';
import { fontkitSource } from './fontkit-face';
import { TEXT_COMPONENTS, type NativeFaces } from './painter';

export const BUILTIN_FONTS_URL = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Fragment+Mono&display=block';

export type Reader = { text: (url: string) => Promise<string>; bytes: (url: string) => Promise<Uint8Array> };

const web: Reader = {
  text: (url) => fetch(url).then((r) => (r.ok ? r.text() : '')),
  bytes: (url) => fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status} ${url}`)))).then((b) => new Uint8Array(b))
};

const SPACE = 0x20;

function codePointsOf(doc: MotionDoc): number[] {
  const texts = doc.tracks.flatMap((t) => t.clips.filter((c) => (TEXT_COMPONENTS as readonly string[]).includes(c.component)).map((c) => String(c.props.text ?? '')));
  const all = texts.flatMap((t) => [t, t.toUpperCase(), t.toLowerCase()]).join('');
  return [...new Set([SPACE, ...[...all].map((c) => c.codePointAt(0)!)])];
}

const needed = (rule: FaceRule, points: number[]) => points.some((cp) => rule.ranges.some(([lo, hi]) => lo <= cp && cp <= hi));

const remembered = <T>(load: (url: string) => Promise<T>) => {
  const seen = new Map<string, Promise<T>>();
  return (url: string) => {
    const hit = seen.get(url) ?? load(url);
    seen.set(url, hit);
    return hit;
  };
};

export type Loaded = { book: FaceBook; native: NativeFaces };

export function facesLoader(read: Reader = web): (doc: MotionDoc, assets: Record<string, string>) => Promise<Loaded> {
  const sheet = remembered((url) => read.text(url).catch(() => ''));
  const source = remembered((url) => read.bytes(url).then((bytes): [string, Source] => [url, fontkitSource(bytes)]).catch(() => null));
  return async (doc, assets) => {
    const google = googleFontsUrl(usedFaces(doc), doc.fonts);
    const css = await Promise.all([BUILTIN_FONTS_URL, ...(google ? [google] : [])].map(sheet));
    const rules = [...css, uploadFaceCss(doc.fonts, assets)].flatMap(faceRules);
    const points = codePointsOf(doc);
    const urls = [...new Set(rules.filter((r) => needed(r, points)).map((r) => r.url))];
    const sources = new Map((await Promise.all(urls.map(source))).filter((l): l is [string, Source] => l !== null));
    return { book: faceBook(rules, sources, doc.fonts), native: { rules: rules.filter((r) => sources.has(r.url)), registry: doc.fonts } };
  };
}

export function fontLoader(read: Reader = web): (doc: MotionDoc, assets: Record<string, string>) => Promise<FaceBook> {
  const load = facesLoader(read);
  return (doc, assets) => load(doc, assets).then((l) => l.book);
}

export const loadFonts = fontLoader();
