export enum ProjectMode {
  Standard = 'standard',
  Nsfw = 'nsfw'
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

export enum ModerationProfile {
  General = 'general',
  Adult = 'adult'
}

const EVERYTHING_BUT_WIRO = new Set(Object.values(Capability).filter((c) => c !== Capability.WiroModels));

export const MODE_ALLOWS: Readonly<Record<ProjectMode, ReadonlySet<Capability>>> = {
  [ProjectMode.Standard]: EVERYTHING_BUT_WIRO,
  [ProjectMode.Nsfw]: new Set([Capability.WiroModels, Capability.StandardModels])
};

export const MODE_REFUSAL: Readonly<Record<Capability, string>> = {
  [Capability.Share]: 'nsfw_not_shareable',
  [Capability.Publish]: 'nsfw_not_publishable',
  [Capability.Schedule]: 'nsfw_not_publishable',
  [Capability.Promote]: 'nsfw_not_publishable',
  [Capability.CatalogueWrite]: 'nsfw_not_in_catalogue',
  [Capability.WiroModels]: 'wiro_requires_nsfw_project',
  [Capability.StandardModels]: 'model_not_in_this_project'
};

const MODERATION_PROFILE: Readonly<Record<ProjectMode, Readonly<Record<'uncensored' | 'standard', ModerationProfile>>>> = {
  [ProjectMode.Standard]: { uncensored: ModerationProfile.General, standard: ModerationProfile.General },
  [ProjectMode.Nsfw]: { uncensored: ModerationProfile.Adult, standard: ModerationProfile.General }
};

const WIRO_PREFIX = 'wiro/';

export const STORAGE_FOLDER: Readonly<Record<ProjectMode, string>> = {
  [ProjectMode.Standard]: 'media',
  [ProjectMode.Nsfw]: 'nsfw'
};

export function modeOf(value: unknown): ProjectMode {
  return value === ProjectMode.Nsfw ? ProjectMode.Nsfw : ProjectMode.Standard;
}

export function modeAllows(mode: ProjectMode, capability: Capability): boolean {
  return MODE_ALLOWS[mode].has(capability);
}

function capabilityOfModel(model: string): Capability {
  return model.startsWith(WIRO_PREFIX) ? Capability.WiroModels : Capability.StandardModels;
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

export function moderationProfileOf(mode: ProjectMode, uncensored: boolean): ModerationProfile {
  return MODERATION_PROFILE[mode][uncensored ? 'uncensored' : 'standard'];
}

type Offered = { choices: readonly { id: string }[]; recommended?: readonly { id: string }[] };

export function catalogueIn<K extends string, M extends Offered>(mode: ProjectMode, catalogue: Record<K, M>): Record<K, M> {
  return Object.fromEntries(
    Object.entries<M>(catalogue).map(([medium, entry]) => [
      medium,
      { ...entry, choices: offerableIn(mode, entry.choices), ...(entry.recommended ? { recommended: offerableIn(mode, entry.recommended) } : {}) }
    ])
  ) as Record<K, M>;
}
