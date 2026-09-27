export type AnalysisStep = { label: string };

export const ANALYSIS_STEPS: readonly AnalysisStep[] = [
  { label: 'Fetching the homepage' },
  { label: 'Reading logo and colours' },
  { label: 'Following links to other pages' },
  { label: 'Extracting the description' },
  { label: 'Detecting products' },
  { label: 'Finding social handles' },
  { label: 'Drafting the target audience' }
];

export const ANALYSIS_STEP_INTERVAL_MS = 2500;

export function analysisStepIndexAt(elapsedMs: number, stepCount: number, intervalMs = ANALYSIS_STEP_INTERVAL_MS): number {
  if (stepCount <= 0) return 0;
  return Math.floor(elapsedMs / intervalMs) % stepCount;
}
