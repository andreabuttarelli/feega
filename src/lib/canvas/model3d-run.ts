import type { ModelChoice } from './gen-node';
import { listedCredits } from './gen-cost';

export enum Model3dPath {
  FromImage = 'from_image',
  FromText = 'from_text'
}

export const MODEL3D_INPUT_REQUIRED = 'Connect an image, or describe the object to model in 3D.';

type Model3dStart = { kind: 'run'; path: Model3dPath } | { kind: 'refused'; error: string };

type Model3dInputs = { hasImage: boolean; hasText: boolean };

const MODEL3D_RUN_RULES: ReadonlyArray<Model3dInputs & { start: Model3dStart }> = [
  { hasImage: true, hasText: true, start: { kind: 'run', path: Model3dPath.FromImage } },
  { hasImage: true, hasText: false, start: { kind: 'run', path: Model3dPath.FromImage } },
  { hasImage: false, hasText: true, start: { kind: 'run', path: Model3dPath.FromText } },
  { hasImage: false, hasText: false, start: { kind: 'refused', error: MODEL3D_INPUT_REQUIRED } }
];

export function model3dPathOf(inputs: Model3dInputs): Model3dStart {
  return MODEL3D_RUN_RULES.find((rule) => rule.hasImage === inputs.hasImage && rule.hasText === inputs.hasText)!.start;
}

export function productShotPrompt(text: string): string {
  return [
    `A single product photo of ${text.trim()}.`,
    'One object only, whole and centred in frame, three-quarter view.',
    'Plain pure white background, soft even studio light, no props, no text, no people.'
  ].join(' ');
}

export function cheapestImageChoice(choices: readonly ModelChoice[]): ModelChoice | null {
  const priced = choices
    .filter((c) => !c.uncensored && (c.inputModalities ?? []).includes('text'))
    .map((choice) => ({ choice, credits: listedCredits(choice) }))
    .filter((entry): entry is { choice: ModelChoice; credits: number } => typeof entry.credits === 'number');

  priced.sort((a, b) => a.credits - b.credits);
  return priced[0]?.choice ?? null;
}

export type ImageStepQuote = { prompt: string; hasUpstreamText: boolean; hasUpstreamImage: boolean; imageChoices: readonly ModelChoice[] };

export function imageStepCredits(input: ImageStepQuote): number {
  const start = model3dPathOf({ hasImage: input.hasUpstreamImage, hasText: Boolean(input.prompt.trim()) || input.hasUpstreamText });
  if (start.kind !== 'run' || start.path !== Model3dPath.FromText) {
    return 0;
  }
  const choice = cheapestImageChoice(input.imageChoices);
  return choice ? (listedCredits(choice) ?? 0) : 0;
}
