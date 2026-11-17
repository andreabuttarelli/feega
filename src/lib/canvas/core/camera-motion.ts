export enum CameraMotion {
  Still = 'still',
  Moving = 'moving'
}

export type TileDom<M> = { on: boolean; resizable: boolean; showAdd: boolean; marks: readonly M[] };

type Rule = {
  tile: <M>(dom: TileDom<M>) => TileDom<M>;
  overlays: <F extends { id: string }>(frames: F[], editing: (id: string) => boolean) => F[];
  rests: boolean;
};

const DURING: Record<CameraMotion, Rule> = {
  [CameraMotion.Still]: { tile: (dom) => dom, overlays: (frames) => frames, rests: true },
  [CameraMotion.Moving]: { tile: () => ({ on: false, resizable: false, showAdd: false, marks: [] }), overlays: (frames, editing) => frames.filter((f) => editing(f.id)), rests: false }
};

export const tileDom = <M>(dom: TileDom<M>, motion: CameraMotion): TileDom<M> => DURING[motion].tile(dom);

export const screenOverlays = <F extends { id: string }>(frames: F[], editing: (id: string) => boolean, motion: CameraMotion): F[] => DURING[motion].overlays(frames, editing);

export const shownAtRest = <T>(value: T | null, motion: CameraMotion): T | null => (DURING[motion].rests ? value : null);
