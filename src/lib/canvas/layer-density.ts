export enum Density {
  Pointer = 'pointer',
  Touch = 'touch'
}

export const ROW_STEP_PX: Record<Density, number> = {
  [Density.Pointer]: 29,
  [Density.Touch]: 45
};
