import { AiState, ToView, type ViewMessage } from '../messages';
import type { AcpAgent } from '../host/ai/acp-agents';
import { answered, heard, said, type Item } from './ai-transcript';

export const ai = $state<{ agents: AcpAgent[]; state: AiState; agent: string | null; items: Item[] }>({ agents: [], state: AiState.Idle, agent: null, items: [] });

export function aiHeard(message: ViewMessage) {
  if (message.kind === ToView.AiAgents) {
    ai.agents = message.agents;
  } else if (message.kind === ToView.AiState) {
    ai.state = message.state;
    ai.agent = message.agent ?? null;
  } else if (message.kind === ToView.AiEvent) {
    ai.items = heard(ai.items, message.event);
  }
}

export const aiSaid = (text: string, context: string | null) => (ai.items = said(ai.items, text, context));

export const aiAnswered = (id: string, answer: string) => (ai.items = answered(ai.items, id, answer));

export const aiCleared = () => (ai.items = []);
