import { AiState, ToView, type ViewMessage } from '../messages';
import type { AcpAgent } from '../host/ai/acp-agents';
import { AgentEventKind, type ModeView } from '../host/ai/agent-session';
import { Policy } from '../host/ai/permission-policy';
import { answered, heard, said, type Item } from '../host/ai/transcript';

export const ai = $state<{ agents: AcpAgent[]; state: AiState; agent: string | null; items: Item[]; modes: ModeView[]; mode: string | null; policy: Policy }>({ agents: [], state: AiState.Idle, agent: null, items: [], modes: [], mode: null, policy: Policy.Ask });

export function aiHeard(message: ViewMessage) {
  if (message.kind === ToView.AiAgents) {
    ai.agents = message.agents;
  } else if (message.kind === ToView.AiState) {
    ai.state = message.state;
    ai.agent = message.agent ?? null;
  } else if (message.kind === ToView.AiPolicy) {
    ai.policy = message.policy;
  } else if (message.kind === ToView.AiEvent && message.event.kind === AgentEventKind.Modes) {
    ai.modes = message.event.available;
    ai.mode = message.event.current;
  } else if (message.kind === ToView.AiEvent) {
    ai.items = heard(ai.items, message.event);
  }
}

export const aiSaid = (text: string, context: string | null) => (ai.items = said(ai.items, text, context));

export const aiAnswered = (id: string, answer: string) => (ai.items = answered(ai.items, id, answer));

export const aiCleared = () => {
  ai.items = [];
  ai.modes = [];
  ai.mode = null;
};
