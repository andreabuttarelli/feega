export enum ProjectMode {
  Standard = 'standard',
  Uncensored = 'uncensored'
}

export function modeOf(value: unknown): ProjectMode {
  return value === ProjectMode.Uncensored ? ProjectMode.Uncensored : ProjectMode.Standard;
}
