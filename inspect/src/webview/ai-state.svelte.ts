import { AiState, ToView, type ChatRow, type ViewMessage } from '../messages';
import type { AcpAgent } from '../host/ai/acp-agents';
import { AgentEventKind, type ConfigView, type ModeView } from '../host/ai/agent-session';
import { Policy } from '../host/ai/permission-policy';
import { answered, heard, said, type Item } from '../host/ai/transcript';

export const ai = $state<{ agents: AcpAgent[]; state: AiState; agent: string | null; items: Item[]; modes: ModeView[]; mode: string | null; configs: ConfigView[]; policy: Policy; chats: ChatRow[]; chat: string | null; consent: { agent: string; label: string } | null }>({ agents: [], state: AiState.Idle, agent: null, items: [], modes: [], mode: null, configs: [], policy: Policy.Ask, chats: [], chat: null, consent: null });

const mine = (chat: string | undefined): boolean => chat === undefined || chat === ai.chat;

export function aiHeard(message: ViewMessage) {
  if (message.kind === ToView.AiAgents) {
    ai.agents = message.agents;
  } else if (message.kind === ToView.AiChats) {
    ai.chats = message.chats;
  } else if (message.kind === ToView.AiConsent) {
    ai.consent = { agent: message.agent, label: message.label };
  } else if (message.kind === ToView.AiChat) {
    ai.consent = null;
    ai.chat = message.chat;
    ai.agent = message.agent ?? null;
    ai.state = message.state;
    ai.items = message.items;
    ai.modes = message.modes;
    ai.mode = message.mode;
    ai.configs = message.configs;
  } else if (message.kind === ToView.AiState && mine(message.chat)) {
    ai.state = message.state;
    ai.agent = message.agent ?? null;
  } else if (message.kind === ToView.AiPolicy) {
    ai.policy = message.policy;
  } else if (message.kind === ToView.AiEvent && mine(message.chat) && message.event.kind === AgentEventKind.Modes) {
    ai.modes = message.event.available;
    ai.mode = message.event.current;
  } else if (message.kind === ToView.AiEvent && mine(message.chat) && message.event.kind === AgentEventKind.Config) {
    ai.configs = message.event.options;
  } else if (message.kind === ToView.AiEvent && mine(message.chat)) {
    ai.items = heard(ai.items, message.event);
  }
}

export const aiSaid = (text: string, context: string | null) => (ai.items = said(ai.items, text, context));

export const aiAnswered = (id: string, answer: string) => (ai.items = answered(ai.items, id, answer));
