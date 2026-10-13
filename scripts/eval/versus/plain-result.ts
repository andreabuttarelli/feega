import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const PLAIN_MODEL = 'claude-opus-5-5';
export const PLAIN_VIDEO = 'out.mp4';
export const PLAIN_RESULT = 'plain.json';

export type PlainResult = { work: string; exitCode: number | null; timedOut: boolean; wallS: number; video: boolean; raw: string; stderr: string };

export type Usage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costUsd: number };

export type PlainArm = { ran: boolean; video: string | null; usage: Usage | null; wallS: number | null; failure: string | null };

type ClaudeJson = { total_cost_usd?: number; is_error?: boolean; subtype?: string; usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } };

export function parseUsage(raw: string): Usage | null {
  const json = (() => {
    try {
      return JSON.parse(raw) as ClaudeJson;
    } catch {
      return null;
    }
  })();
  if (!json?.usage) {
    return null;
  }
  const u = json.usage;
  return { inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0, cacheReadTokens: u.cache_read_input_tokens ?? 0, cacheWriteTokens: u.cache_creation_input_tokens ?? 0, costUsd: json.total_cost_usd ?? 0 };
}

export function failureOf(r: PlainResult): string | null {
  if (r.video) {
    return null;
  }
  if (r.timedOut) {
    return 'killed at the 30 min cap, no out.mp4';
  }
  const subtype = (() => {
    try {
      return (JSON.parse(r.raw) as ClaudeJson).subtype;
    } catch {
      return null;
    }
  })();
  return `no out.mp4 (exit ${r.exitCode}${subtype ? `, ${subtype}` : ''})`;
}

export function readPlain(dir: string): PlainArm {
  const file = join(dir, PLAIN_RESULT);
  if (!existsSync(file)) {
    return { ran: false, video: null, usage: null, wallS: null, failure: `Arm A never ran: ${file} missing (run npm run eval:versus:plain)` };
  }
  const r = JSON.parse(readFileSync(file, 'utf8')) as PlainResult;
  const video = join(dir, PLAIN_VIDEO);
  return { ran: true, video: existsSync(video) ? video : null, usage: parseUsage(r.raw), wallS: r.wallS, failure: failureOf(r) };
}
