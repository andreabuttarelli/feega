export enum Density {
  Pointer = 'pointer',
  Touch = 'touch'
}

export const ROW_STEP_PX: Record<Density, number> = {
  [Density.Pointer]: 33,
  [Density.Touch]: 45
};
