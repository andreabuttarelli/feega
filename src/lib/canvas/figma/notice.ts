import { ImagesOutcome } from './fetch-images';

export type NoticeGroup = { label: string; items: string[] };
export type FigmaNotice = { summary: string; groups: NoticeGroup[]; needsToken: boolean };
export type NoticeInput = { skipped: string[]; images: number; outcome: ImagesOutcome | null };

const FALLBACK_GROUP = 'Other';

const GROUPS: [RegExp, string][] = [
  [/instance|component/i, 'Components'],
  [/font/i, 'Fonts'],
  [/auto layout/i, 'Layout'],
  [/gradient|stroke|fill|effect|shadow|blur/i, 'Paint and effects'],
  [/placeholder|without geometry/i, 'Placeholders']
];

const groupOf = (item: string) => GROUPS.find(([pattern]) => pattern.test(item))?.[1] ?? FALLBACK_GROUP;

function groupsOf(skipped: string[]): NoticeGroup[] {
  const byLabel = new Map<string, string[]>();
  for (const item of skipped) {
    const label = groupOf(item);
    byLabel.set(label, [...(byLabel.get(label) ?? []), item]);
  }
  return [...byLabel].map(([label, items]) => ({ label, items }));
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const IMAGE_LINE: Record<ImagesOutcome, ((n: number) => string) | null> = {
  [ImagesOutcome.Filled]: null,
  [ImagesOutcome.NoToken]: (n) => `${plural(n, 'image is a grey placeholder', 'images are grey placeholders')}: add a Figma token in Settings to import ${n === 1 ? 'it' : 'them'}.`,
  [ImagesOutcome.Failed]: (n) => `${plural(n, 'image could not be loaded and stays a grey placeholder', 'images could not be loaded and stay grey placeholders')}.`
};

export function figmaNotice({ skipped, images, outcome }: NoticeInput): FigmaNotice | null {
  const imageLine = images && outcome ? IMAGE_LINE[outcome]?.(images) : null;
  if (!skipped.length && !imageLine) {
    return null;
  }
  const approximations = skipped.length ? `${plural(skipped.length, 'approximation', 'approximations')}.` : '';
  const head = approximations ? `Pasted from Figma: ${approximations}` : 'Pasted from Figma:';
  return { summary: [head, imageLine].filter(Boolean).join(' '), groups: groupsOf(skipped), needsToken: outcome === ImagesOutcome.NoToken && images > 0 };
}
