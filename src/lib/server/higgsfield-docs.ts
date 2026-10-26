import type { WireFields } from './canvas/task-provider';
import type { HiggsfieldModel } from './higgsfield-catalogue';
import { ESTIMATE_IMAGE, ESTIMATE_PROMPT, ESTIMATE_VIDEO } from './higgsfield-catalogue';

const DOCS_ORIGIN = 'https://docs.higgsfield.ai/docs';
const SITEMAP_URL = `${DOCS_ORIGIN}/sitemap.xml`;
const MODEL_PAGE = /<loc>(https:\/\/docs\.higgsfield\.ai\/docs\/models\/[^/<]+\/[^/<]+)<\/loc>/g;
const ENDPOINT_ID = /\*\*Endpoint ID:\*\* `([^`]+)`/;
const TITLE = /^# (.+)$/m;
const INPUT_SCHEMA = '## Input schema';
const FIELD_HEADER = /^\*\*([^*]+)\*\* `(\w+)`( \*required\*)?( \(default: ([^)]*)\))?\s*$/gm;
const ALLOWED = /Allowed values: (.+?)\.?$/m;
const MINIMUM = /Minimum: `(-?\d+)`/;
const MAXIMUM = /Maximum: `(-?\d+)`/;
const PAGE_BATCH = 10;
const MAX_PRICE_PAIRS = 24;
const MAX_RANGE_VALUES = 40;
const VIDEO_PATH = /video/;

type DocValue = string | number;

export type DocField = {
  name: string;
  type: string;
  required: boolean;
  hasDefault: boolean;
  values: DocValue[];
};

export type HiggsfieldDoc = { path: string; title: string; fields: DocField[] };

const unescaped = (name: string): string => name.replace(/\\/g, '');

function valuesOf(type: string, body: string): DocValue[] {
  const allowed = body.match(ALLOWED)?.[1];
  if (allowed) {
    const tokens = [...allowed.matchAll(/`([^`]*)`/g)].map((m) => m[1].replace(/^"|"$/g, ''));
    return type === 'integer' || type === 'number' ? tokens.map(Number) : tokens;
  }

  const min = body.match(MINIMUM);
  const max = body.match(MAXIMUM);
  if (type !== 'integer' || !min || !max) {
    return [];
  }
  const span = Number(max[1]) - Number(min[1]) + 1;
  if (span < 1 || span > MAX_RANGE_VALUES) {
    return [];
  }
  return Array.from({ length: span }, (_, index) => Number(min[1]) + index);
}

export function parseModelDoc(markdown: string): HiggsfieldDoc | null {
  const path = markdown.match(ENDPOINT_ID)?.[1];
  const schemaStart = markdown.indexOf(INPUT_SCHEMA);
  if (!path || schemaStart < 0) {
    return null;
  }

  const schema = markdown.slice(schemaStart);
  const headers = [...schema.matchAll(FIELD_HEADER)];
  const fields = headers.map((header, index) => {
    const end = headers[index + 1]?.index ?? schema.length;
    const body = schema.slice(header.index! + header[0].length, end);
    const [, name, type, required, defaulted] = header;
    return { name: unescaped(name), type, required: Boolean(required), hasDefault: Boolean(defaulted), values: valuesOf(type, body) };
  });

  return { path, title: markdown.match(TITLE)?.[1] ?? path, fields: fields.filter((f) => !/[[.]/.test(f.name)) };
}

type Role = (fields: WireFields, name: string) => WireFields;

const ROLES: Readonly<Record<string, Role>> = {
  prompt: (f, name) => ({ ...f, prompt: name }),
  duration: (f, name) => ({ ...f, duration: name }),
  resolution: (f, name) => ({ ...f, resolution: name }),
  aspect_ratio: (f, name) => ({ ...f, aspectRatio: name }),
  image_url: (f, name) => ({ ...f, images: [name] }),
  end_image_url: (f, name) => ({ ...f, lastFrame: name }),
  last_image_url: (f, name) => ({ ...f, lastFrame: name }),
  last_frame_url: (f, name) => ({ ...f, lastFrame: name }),
  image_urls: (f, name) => ({ ...f, imageList: name }),
  video_url: (f, name) => ({ ...f, video: name }),
  video_urls: (f, name) => ({ ...f, videoList: name }),
  audio_urls: (f, name) => ({ ...f, audioList: name })
};

const SAMPLE_INPUTS: Readonly<Record<string, unknown>> = {
  prompt: ESTIMATE_PROMPT,
  image_url: ESTIMATE_IMAGE,
  image_urls: [ESTIMATE_IMAGE],
  video_url: ESTIMATE_VIDEO,
  video_urls: [ESTIMATE_VIDEO]
};

const PRICED_BY = ['duration', 'resolution'] as const;
const SCHEMA_ENUMS: Readonly<Record<string, string>> = { duration: 'duration', aspect_ratio: 'aspect_ratio' };

function pairCount(variants: ReadonlyArray<{ values: readonly unknown[] }>): number {
  return variants.reduce((count, variant) => count * variant.values.length, 1);
}

function wiredFields(doc: HiggsfieldDoc): WireFields {
  return doc.fields.reduce<WireFields>((fields, field) => ROLES[field.name]?.(fields, field.name) ?? fields, { images: [] });
}

function fillableRequired(doc: HiggsfieldDoc): boolean {
  return doc.fields.filter((f) => f.required && !f.hasDefault).every((f) => f.name in SAMPLE_INPUTS);
}

function fieldNamed(doc: HiggsfieldDoc, name: string): DocField | undefined {
  return doc.fields.find((f) => f.name === name);
}

export function modelFromDoc(doc: HiggsfieldDoc): HiggsfieldModel | null {
  if (!fieldNamed(doc, 'prompt') || !fillableRequired(doc)) {
    return null;
  }

  const fields = wiredFields(doc);
  const variants = doc.fields.filter((f) => (PRICED_BY as readonly string[]).includes(f.name) && f.values.length > 0).map((f) => ({ key: f.name, values: f.values }));
  const askable = pairCount(variants) <= MAX_PRICE_PAIRS;
  const required = doc.fields.filter((f) => f.required && f.name in SAMPLE_INPUTS);
  const needs = (name: string): boolean => required.some((f) => f.name === name);
  const requiresImage = needs('image_url') || undefined;
  const requiresVideo = needs('video_url') || undefined;
  const wire = askable ? { requiresImage, requiresVideo } : { requiresImage, requiresVideo, quotedAtSubmit: true as const };
  const resolution = fieldNamed(doc, 'resolution');

  return {
    path: doc.path,
    label: doc.title,
    catalogue: fields.duration || VIDEO_PATH.test(doc.path) ? 'video' : 'image',
    fields,
    numeric: fields.duration ? [fields.duration] : [],
    priceBy: askable ? variants : [],
    schema: Object.fromEntries(
      doc.fields.filter((f) => f.name in SCHEMA_ENUMS && f.values.length > 0).map((f) => [SCHEMA_ENUMS[f.name], f.values])
    ),
    estimateBase: Object.fromEntries(required.map((f) => [f.name, SAMPLE_INPUTS[f.name]])),
    resolutions: askable || !resolution ? undefined : resolution.values.map(String),
    wire
  };
}

async function textOf(doFetch: typeof fetch, url: string): Promise<string> {
  const res = await doFetch(url);
  if (!res.ok) {
    throw new Error(`higgsfield_docs_failed: HTTP ${res.status} on ${url}`);
  }
  return res.text();
}

export async function fetchHiggsfieldModels(doFetch: typeof fetch = fetch): Promise<HiggsfieldModel[]> {
  const pages = [...new Set([...(await textOf(doFetch, SITEMAP_URL)).matchAll(MODEL_PAGE)].map((m) => m[1]))];
  const models: HiggsfieldModel[] = [];

  for (let start = 0; start < pages.length; start += PAGE_BATCH) {
    const batch = await Promise.all(
      pages.slice(start, start + PAGE_BATCH).map((url) =>
        textOf(doFetch, `${url}.md`).then((markdown) => {
          const doc = parseModelDoc(markdown);
          return doc ? modelFromDoc(doc) : null;
        }, () => null)
      )
    );
    models.push(...batch.filter((model): model is HiggsfieldModel => model !== null));
  }

  return models;
}

export function withDiscovered(known: readonly HiggsfieldModel[], discovered: readonly HiggsfieldModel[]): HiggsfieldModel[] {
  const paths = new Set(known.map((model) => model.path));
  return [...known, ...discovered.filter((model) => !paths.has(model.path))];
}
