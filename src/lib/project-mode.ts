export enum ProjectMode {
  Standard = 'standard',
  Uncensored = 'uncensored'
}

export enum Capability {
  Share = 'share',
  Publish = 'publish',
  Schedule = 'schedule',
  Promote = 'promote',
  CatalogueWrite = 'catalogue_write',
  WiroModels = 'wiro_models',
  StandardModels = 'standard_models'
}

const EVERYTHING_BUT_WIRO = new Set(Object.values(Capability).filter((c) => c !== Capability.WiroModels));

export const MODE_ALLOWS: Readonly<Record<ProjectMode, ReadonlySet<Capability>>> = {
  [ProjectMode.Standard]: EVERYTHING_BUT_WIRO,
  [ProjectMode.Uncensored]: new Set([Capability.WiroModels, Capability.StandardModels])
};

export const MODE_REFUSAL: Readonly<Record<Capability, string>> = {
  [Capability.Share]: 'uncensored_not_shareable',
  [Capability.Publish]: 'uncensored_not_publishable',
  [Capability.Schedule]: 'uncensored_not_publishable',
  [Capability.Promote]: 'uncensored_not_publishable',
  [Capability.CatalogueWrite]: 'uncensored_not_in_catalogue',
  [Capability.WiroModels]: 'wiro_requires_uncensored_project',
  [Capability.StandardModels]: 'model_not_in_this_project'
};

const WIRO_PREFIX = 'wiro/';

export const SECTION_CAPABILITY: Readonly<Record<string, Capability>> = {
  calendar: Capability.Schedule,
  promote: Capability.Promote,
  ads: Capability.Promote,
  influencers: Capability.CatalogueWrite
};

export const STORAGE_FOLDER: Readonly<Record<ProjectMode, string>> = {
  [ProjectMode.Standard]: 'media',
  [ProjectMode.Uncensored]: 'uncensored'
};

export function modeOf(value: unknown): ProjectMode {
  return value === ProjectMode.Uncensored ? ProjectMode.Uncensored : ProjectMode.Standard;
}

export function modeAllows(mode: ProjectMode, capability: Capability): boolean {
  return MODE_ALLOWS[mode].has(capability);
}

function capabilityOfModel(model: string): Capability {
  return model.startsWith(WIRO_PREFIX) ? Capability.WiroModels : Capability.StandardModels;
}

export function sectionAllowed(mode: ProjectMode, section: string): boolean {
  const capability = SECTION_CAPABILITY[section];
  return !capability || modeAllows(mode, capability);
}

export function modelAllowedIn(mode: ProjectMode, model: string | null | undefined): boolean {
  if (!model) {
    return true;
  }
  return modeAllows(mode, capabilityOfModel(model));
}

export function modelRefusal(mode: ProjectMode, model: string | null | undefined): string | null {
  return modelAllowedIn(mode, model) ? null : MODE_REFUSAL[capabilityOfModel(model ?? '')];
}

export function offerableIn<C extends { id: string }>(mode: ProjectMode, choices: readonly C[]): C[] {
  return choices.filter((choice) => modelAllowedIn(mode, choice.id));
}

const CATALOGUE_LISTS = ['choices', 'recommended', 'candidates'] as const;

type Offered = { [L in (typeof CATALOGUE_LISTS)[number]]?: readonly { id: string }[] };

function entryIn<M extends Offered>(mode: ProjectMode, entry: M): M {
  const filtered = CATALOGUE_LISTS.filter((list) => entry[list]).map((list) => [list, offerableIn(mode, entry[list] ?? [])]);
  return { ...entry, ...Object.fromEntries(filtered) };
}

export function catalogueIn<K extends string, M extends Offered>(mode: ProjectMode, catalogue: Record<K, M>): Record<K, M> {
  return Object.fromEntries(Object.entries<M>(catalogue).map(([medium, entry]) => [medium, entryIn(mode, entry)])) as Record<K, M>;
}
