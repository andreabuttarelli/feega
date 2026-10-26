import { parse } from 'yaml';
import type { WireFields } from './canvas/task-provider';

export const KIE_DOCS_INDEX = 'https://docs.kie.ai/llms.txt';

const MARKET_DOC = /https:\/\/docs\.kie\.ai\/market\/[^)\s]+\.md/g;

const DOC_BATCH = 12;

const SPEC_BLOCK = /```yaml\n([\s\S]*?)\n```/;

const LIST_REFS = new Set(['image_urls', 'input_urls', 'image_input', 'reference_image_urls']);

const NEEDS_INPUT_MEDIA = /video-to|reference-to|keyframe-to|videoedit|video-edit|extend|upscale|transition|motion-control|lip-sync|segment/;

const FILLED_BY_WIRE = new Set(['prompt', 'aspect_ratio', 'resolution', 'duration', 'image_url', 'first_frame_url', ...LIST_REFS]);

const DURATION_RANGE = /(\d+)\s*-\s*(\d+)\s*seconds/i;

export type KieSpec = {
  model: string;
  label: string;
  fields: WireFields;
  aspectRatios: string[];
  resolutions: string[];
  durations: number[];
  numericDuration: boolean;
  maxRefs: number;
  requiresImage?: true;
};

type Prop = { type?: string; enum?: unknown[]; maxItems?: number; description?: string };

type Schema = { properties?: { model?: { default?: string }; input?: { required?: string[]; properties?: Record<string, Prop> } } };

type Doc = { paths?: Record<string, { post?: { summary?: string; requestBody?: { content?: Record<string, { schema?: Schema }> } } }> };

const enumOf = (prop: Prop | undefined): string[] => (prop?.enum ?? []).map(String);

function fieldsOf(props: Record<string, Prop>): WireFields {
  const listName = Object.keys(props).find((name) => LIST_REFS.has(name));
  return {
    ...(props.prompt ? { prompt: 'prompt' } : {}),
    ...(props.aspect_ratio ? { aspectRatio: 'aspect_ratio' } : {}),
    ...(props.resolution ? { resolution: 'resolution' } : {}),
    ...(props.duration ? { duration: 'duration' } : {}),
    images: ['image_url', 'first_frame_url'].filter((name) => props[name]),
    ...(props.last_frame_url ? { lastFrame: 'last_frame_url' } : {}),
    ...(listName ? { imageList: listName } : {})
  };
}

function durationsOf(prop: Prop | undefined): number[] {
  const listed = enumOf(prop).map(Number).filter(Number.isFinite);
  const range = (prop?.description ?? '').match(DURATION_RANGE);
  if (listed.length || !range) {
    return listed;
  }
  const [from, to] = [Number(range[1]), Number(range[2])];
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

const needsImage = (required: readonly string[]): boolean => required.some((name) => name === 'image_url' || name === 'first_frame_url' || LIST_REFS.has(name));

export function specOfDoc(text: string): KieSpec | null {
  const block = text.match(SPEC_BLOCK)?.[1];
  if (!block) {
    return null;
  }
  let doc: Doc;
  try {
    doc = parse(block) as Doc;
  } catch {
    return null;
  }
  const post = doc?.paths?.['/api/v1/jobs/createTask']?.post;
  const schema = post?.requestBody?.content?.['application/json']?.schema;
  const model = schema?.properties?.model?.default;
  const input = schema?.properties?.input;
  if (!model || !input?.properties || NEEDS_INPUT_MEDIA.test(model)) {
    return null;
  }
  const props = input.properties;
  if ((input.required ?? []).some((name) => !FILLED_BY_WIRE.has(name) || !props[name])) {
    return null;
  }
  const listName = Object.keys(props).find((name) => LIST_REFS.has(name));
  return {
    model,
    label: post?.summary?.trim() || model,
    fields: fieldsOf(props),
    aspectRatios: enumOf(props.aspect_ratio),
    resolutions: enumOf(props.resolution),
    durations: durationsOf(props.duration),
    numericDuration: props.duration?.type === 'integer' || props.duration?.type === 'number',
    maxRefs: listName ? (props[listName].maxItems ?? 1) : 0,
    ...(needsImage(input.required ?? []) ? { requiresImage: true as const } : {})
  };
}

async function textOf(doFetch: typeof fetch, url: string): Promise<string> {
  const res = await doFetch(url);
  if (!res.ok) {
    throw new Error(`kie_docs_failed: HTTP ${res.status} on ${url}`);
  }
  return res.text();
}

export async function fetchKieSpecs(doFetch: typeof fetch = fetch): Promise<KieSpec[]> {
  const urls = [...new Set((await textOf(doFetch, KIE_DOCS_INDEX)).match(MARKET_DOC) ?? [])];
  const specs: KieSpec[] = [];
  for (let start = 0; start < urls.length; start += DOC_BATCH) {
    const batch = await Promise.all(urls.slice(start, start + DOC_BATCH).map((url) => textOf(doFetch, url).then(specOfDoc, () => null)));
    specs.push(...batch.filter((spec): spec is KieSpec => spec !== null));
  }
  return specs;
}
