export enum CameraMotion {
  Still = 'still',
  Moving = 'moving'
}

export type TileDom<M> = { on: boolean; resizable: boolean; showAdd: boolean; marks: readonly M[] };

const DOM_OF: Record<CameraMotion, <M>(dom: TileDom<M>) => TileDom<M>> = {
  [CameraMotion.Still]: (dom) => dom,
  [CameraMotion.Moving]: () => ({ on: false, resizable: false, showAdd: false, marks: [] })
};

export const tileDom = <M>(dom: TileDom<M>, motion: CameraMotion): TileDom<M> => DOM_OF[motion](dom);
