import { ProjectMode } from '$lib/project-mode';
import type { ScreenOutcome } from './screen';

export enum ReferenceMedium {
  Image = 'image',
  Video = 'video'
}

export type Reference = { medium: ReferenceMedium; url: string };

export enum PeopleVerdict {
  Absent = 'absent',
  Present = 'present',
  Unknown = 'unknown'
}

export type PeopleDetector = (reference: Reference) => Promise<PeopleVerdict>;

export const PEOPLE_REFUSAL =
  "Refused: references showing people can't be used in uncensored projects. Use references without people — objects, places, products or styles.";

const DETECTOR_DOWN = 'moderation_unavailable: the people check on references could not run';

export const PEOPLE_DETECTOR_SYSTEM = [
  'You check one image or video used as a reference for a generator.',
  'Answer whether it shows any human being: a face, a body or any part of one, a photo, painting, drawing, statue, doll or 3D render of a person, a silhouette, a crowd, a person in the background.',
  'A non-human cartoon creature, an animal, an object, a product, a landscape or a texture is not a person. When in doubt, answer true.',
  'Answer with JSON only: {"people": boolean, "why": string}.'
].join('\n');

const OUTCOME_OF: Readonly<Record<PeopleVerdict, ScreenOutcome>> = {
  [PeopleVerdict.Absent]: { ok: true },
  [PeopleVerdict.Present]: { ok: false, error: PEOPLE_REFUSAL },
  [PeopleVerdict.Unknown]: { ok: false, error: PEOPLE_REFUSAL }
};

const PEOPLE_SCREENED: Readonly<Record<ProjectMode, boolean>> = {
  [ProjectMode.Standard]: false,
  [ProjectMode.Uncensored]: true
};

export function peopleScreened(mode: ProjectMode): boolean {
  return PEOPLE_SCREENED[mode];
}

export function parsePeopleVerdict(raw: string): PeopleVerdict {
  try {
    const people = (JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as { people?: unknown }).people;
    if (typeof people !== 'boolean') {
      return PeopleVerdict.Unknown;
    }
    return people ? PeopleVerdict.Present : PeopleVerdict.Absent;
  } catch {
    return PeopleVerdict.Unknown;
  }
}

export async function screenReferences(detect: PeopleDetector, mode: ProjectMode, references: readonly Reference[]): Promise<ScreenOutcome> {
  if (!peopleScreened(mode) || !references.length) {
    return { ok: true };
  }

  let verdicts: PeopleVerdict[];
  try {
    verdicts = await Promise.all(references.map(detect));
  } catch {
    return { ok: false, error: DETECTOR_DOWN, unavailable: true };
  }

  return verdicts.map((verdict) => OUTCOME_OF[verdict]).find((outcome) => !outcome.ok) ?? { ok: true };
}
