import type { ChatModelChoice } from '$lib/chat-model';
import { turnModel, Pick } from '$lib/server/project-agent/model-route';

export const AGENT_MODEL = 'anthropic/claude-opus-5.5';

export function planModel(choice: ChatModelChoice, pick: Pick, text: string): ChatModelChoice {
  return turnModel(pick === Pick.Auto ? { ...choice, model: AGENT_MODEL } : choice, pick, text);
}
