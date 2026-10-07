export enum Step {
  Photo = 'photo',
  Style = 'style',
  Generate = 'generate'
}

export const STEPS: readonly { id: Step; label: string }[] = [
  { id: Step.Photo, label: 'Photo' },
  { id: Step.Style, label: 'Style' },
  { id: Step.Generate, label: 'Generate' }
];

export const VERSION_CHOICES: readonly number[] = [1, 2, 3, 4];

export const DEFAULT_VERSIONS = 2;
