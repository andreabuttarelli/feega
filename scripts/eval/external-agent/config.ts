import { homedir } from 'node:os';
import { join } from 'node:path';

export const AGENT_MODEL = 'anthropic/claude-haiku-5.5';
export const JUDGE_MODEL = 'anthropic/claude-sonnet-5.5';
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const TEST_ACCOUNT_EMAIL = 'test@dazero.co';
export const SITE_URL = 'https://feega.app';

export const TASK = `3-scene 9-second launch video for ${SITE_URL}: hero title, one product UI moment, CTA; 1920×1080`;

export const VIDEO = { width: 1920, height: 1080, fps: 30, seconds: 9 } as const;

export const HARD_CAP_USD = 5;
export const ARM_CAP_USD = 1.5;
export const JUDGE_RESERVE_USD = 0.5;
export const JUDGE_MAX_TOKENS = 1500;
export const MAX_TURNS = 60;
export const MAX_OUTPUT_TOKENS = 8192;
export const TOOL_RESULT_MAX_CHARS = 12000;

export const EXCLUDED_FEEGA_TOOLS: ReadonlySet<string> = new Set(['ask_motion_agent']);

export const JUDGE_FRAME_TIMES_S = [1.5, 4.5, 7.5, 8.7];

export const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
export const ANCHORS_DIR = join(REPO_ROOT, 'scripts', 'eval', 'motion-quality', 'anchors');

export function outputDir(day: string): string {
  return join(homedir(), 'Documents', 'feega-videos', 'evals', `external-agent-${day}`);
}
