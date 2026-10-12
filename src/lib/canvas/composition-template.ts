import { MotionFormat } from '$lib/motion/doc';
import { FieldType } from '$lib/motion/template/field-model';
import { starterDoc, starterFormatOf, type StarterFormat } from '$lib/motion/template/catalogue';
import { setTemplateValues, templateFields, type Inserted, type Instance, type TemplateEntry } from '$lib/motion/template/library';
import type { CompositionAspect, UpstreamCard } from './composition-node';

export const FORMAT_OF_ASPECT: Record<CompositionAspect, StarterFormat> = {
  '9:16': MotionFormat.Vertical,
  '1:1': MotionFormat.Square,
  '16:9': MotionFormat.Landscape
};

const ASPECT_OF_FORMAT = Object.fromEntries(Object.entries(FORMAT_OF_ASPECT).map(([aspect, format]) => [format, aspect])) as Record<StarterFormat, CompositionAspect>;

export const aspectOf = (doc: Instance['doc']): CompositionAspect => ASPECT_OF_FORMAT[starterFormatOf(doc)];

const VIDEO_MARK = 'video:';

type Wired = { id: string; video: boolean };
type Keyed = { key: string; type: FieldType };
type Taken = { value: string | null; next: number };

function wiredMedia(cards: readonly UpstreamCard[]): Wired[] {
  return cards.flatMap((card) => {
    if (card.kind === 'motion') {
      return card.posterAssetId ? [{ id: card.posterAssetId, video: false }] : [];
    }
    return [{ id: card.assetId, video: card.kind === 'video' }];
  });
}

const listed = (media: Wired) => (media.video ? `${VIDEO_MARK}${media.id}` : media.id);

const WIRED_FILL: Partial<Record<FieldType, (media: Wired[], at: number) => Taken>> = {
  [FieldType.Asset]: (media, at) => ({ value: media[at]?.id ?? null, next: at + 1 }),
  [FieldType.MediaList]: (media, at) => ({ value: media.slice(at).map(listed).join(',') || null, next: media.length })
};

export const isWiredField = (type: FieldType) => type in WIRED_FILL;

export function templateInputs(fields: readonly Keyed[], values: Record<string, string>, cards: readonly UpstreamCard[]): Record<string, string> {
  const media = wiredMedia(cards);
  const inputs = { ...values };
  let at = 0;

  for (const field of fields) {
    const fill = WIRED_FILL[field.type];
    if (!fill) {
      continue;
    }
    const taken = fill(media, at);
    at = taken.next;
    if (taken.value) {
      inputs[field.key] = taken.value;
    }
  }
  return inputs;
}

export function sequentialIds(): () => string {
  let n = 0;
  return () => `t${++n}`;
}

export type TemplatePick = { format: StarterFormat; values: Record<string, string> };

export function composedTemplate(entry: TemplateEntry, pick: TemplatePick, cards: readonly UpstreamCard[], newId: () => string): Inserted {
  const placed = starterDoc(entry, pick.format, newId);
  if (!placed.ok) {
    return placed;
  }

  const inputs = templateInputs(templateFields(placed.doc, placed.clipId), pick.values, cards);
  if (!Object.keys(inputs).length) {
    return placed;
  }
  const filled = setTemplateValues(placed.doc, placed.clipId, inputs);
  return filled.ok ? { ok: true, doc: filled.doc, clipId: placed.clipId } : filled;
}

const asText = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value));

export function editedValues(instance: Instance): Record<string, string> {
  return Object.fromEntries(
    templateFields(instance.doc, instance.clipId)
      .filter((f) => !isWiredField(f.type) && asText(f.value) !== asText(f.default ?? null))
      .map((f) => [f.key, typeof f.value === 'string' ? f.value : String(f.value)])
  );
}
