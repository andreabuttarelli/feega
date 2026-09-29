import { json } from '@sveltejs/kit';

const UNPROCESSABLE_CONTENT = 422;
export const PROMPT_BLOCKED = 'prompt_blocked';

export function blockedPrompt(error: string): Response {
  return json({ error, code: PROMPT_BLOCKED }, { status: UNPROCESSABLE_CONTENT });
}
