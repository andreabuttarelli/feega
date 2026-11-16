export const RENDER_SECONDS = 60;

export function lengthProblem(seconds: number): string | null {
  return seconds > RENDER_SECONDS ? `videos render up to ${RENDER_SECONDS} s: shorten this one` : null;
}
