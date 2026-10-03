export enum Shot {
  Packshot = 'packshot',
  OnModelFront = 'on_model_front',
  ThreeQuarter = 'three_quarter',
  Detail = 'detail',
  Lifestyle = 'lifestyle'
}

export enum Casting {
  NoPerson = 'no_person',
  OnModel = 'on_model'
}

export type ShotRule = { label: string; casting: Casting; framing: string; safeForKids: boolean };

export const SHOTS: Readonly<Record<Shot, ShotRule>> = {
  [Shot.Packshot]: {
    label: 'Packshot',
    casting: Casting.NoPerson,
    framing: 'product alone, front view, whole product in frame, flat-lay or standing packshot',
    safeForKids: true
  },
  [Shot.OnModelFront]: {
    label: 'On-model front',
    casting: Casting.OnModel,
    framing: 'the model wears or holds the product, full front view, product clearly visible',
    safeForKids: false
  },
  [Shot.ThreeQuarter]: {
    label: 'Three-quarter',
    casting: Casting.OnModel,
    framing: 'the model wears or holds the product, three-quarter angle, product clearly visible',
    safeForKids: false
  },
  [Shot.Detail]: {
    label: 'Detail',
    casting: Casting.NoPerson,
    framing: 'close-up macro of the product material, texture and finish, no person',
    safeForKids: true
  },
  [Shot.Lifestyle]: {
    label: 'Lifestyle',
    casting: Casting.OnModel,
    framing: 'the model uses the product naturally in the scene, candid lifestyle composition',
    safeForKids: false
  }
};

export function isShot(value: string): value is Shot {
  return value in SHOTS;
}
