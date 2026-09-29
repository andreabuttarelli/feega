import { MODERATION_CATEGORIES, type JevDecision, type ModerationCategory } from './policy';

const JEV_MODEL = 'jev-latest';
const QUESTION = 'category';
const USD_PER_MILLION_TOKENS = 0.042;
const TOKENS_PER_MILLION = 1_000_000;

export const DEFAULT_JEV_BASE_URL = 'https://api.typesafe.ai/v1';

export type JevModel = { decide(state: string): Promise<JevDecision & { tokens: number }> };

type JevReply = {
  answers?: Record<string, { choice?: string; probabilities?: Record<string, number> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export function jevUsd(tokens: number): number {
  return (tokens / TOKENS_PER_MILLION) * USD_PER_MILLION_TOKENS;
}

export function jev(config: {
  apiKey: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  categories?: Readonly<Record<string, ModerationCategory>>;
}): JevModel {
  const baseUrl = (config.baseUrl ?? DEFAULT_JEV_BASE_URL).replace(/\/$/, '');
  const doFetch = config.fetchFn ?? fetch;
  const criteria = Object.fromEntries(Object.entries(config.categories ?? MODERATION_CATEGORIES).map(([name, c]) => [name, c.instructions]));

  return {
    async decide(state) {
      const res = await doFetch(`${baseUrl}/systemone`, {
        method: 'POST',
        headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          state,
          model: JEV_MODEL,
          questions: {
            [QUESTION]: {
              type: 'choice',
              instructions: 'Which content-safety category does this generation request fall into?',
              criteria
            }
          }
        })
      });
      if (!res.ok) {
        throw new Error(`jev_failed: HTTP ${res.status}`);
      }

      const body = (await res.json()) as JevReply;
      const answer = body.answers?.[QUESTION];
      if (!answer?.choice || !answer.probabilities) {
        throw new Error('jev_failed: no decision in the reply');
      }
      return {
        choice: answer.choice,
        probabilities: answer.probabilities,
        tokens: (body.usage?.input_tokens ?? 0) + (body.usage?.output_tokens ?? 0)
      };
    }
  };
}
