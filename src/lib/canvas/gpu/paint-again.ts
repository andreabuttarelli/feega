export enum Again {
  Frame = 'frame',
  Later = 'later',
  Never = 'never'
}

export type Owed = { pending: boolean; warming: boolean; warmWait: number; zooming: boolean; overlayWaiting: boolean; sceneBusy: boolean };

export type Next = { at: Again.Frame } | { at: Again.Later; ms: number } | { at: Again.Never };

export function paintAgain(owed: Owed): Next {
  if (owed.pending || owed.zooming || owed.overlayWaiting || owed.sceneBusy) {
    return { at: Again.Frame };
  }
  if (!owed.warming) {
    return { at: Again.Never };
  }
  return owed.warmWait > 0 ? { at: Again.Later, ms: owed.warmWait } : { at: Again.Frame };
}
