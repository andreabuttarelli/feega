export const LOSSES_PER_BACKEND = 3;

export const backendAfterLoss = (backend: number, losses: number, backends: number): number => (losses >= LOSSES_PER_BACKEND && backend + 1 < backends ? backend + 1 : backend);
