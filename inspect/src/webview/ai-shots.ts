export const MAX_SHOTS = 3;

export const attach = (shots: string[], png: string | null): string[] => (png === null || shots.length >= MAX_SHOTS ? shots : [...shots, png]);

export const cameraShown = (images: boolean, ready: boolean): boolean => images && ready;
