export enum OfferReason {
  FirstResult = 'first_result',
  CreditsOut = 'credits_out'
}

export const offerPath = (projectId: string) => `/api/v1/projects/${projectId}/upgrade-offer`;
export const offerCheckoutPath = (projectId: string) => `${offerPath(projectId)}/checkout`;

const MS_PER_S = 1000;
const S_PER_MIN = 60;

export function countdown(expiresAt: number, now: number): string {
  const left = Math.max(0, Math.floor((expiresAt - now) / MS_PER_S));
  const minutes = Math.floor(left / S_PER_MIN);
  const seconds = String(left % S_PER_MIN).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
