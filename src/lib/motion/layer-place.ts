export enum Place {
  Above = 'above',
  Below = 'below',
  Into = 'into'
}

export type LayerSlot = { target: string; place: Place };
