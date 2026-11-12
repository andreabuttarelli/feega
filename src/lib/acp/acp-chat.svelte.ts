import { AcpEventKind, readAcpEvents, type AcpEvent, type AcpOption, type AcpUpdate } from './acp-events';
import type { AcpAgent } from './agent-choices';

export const ACP_ENDPOINT = '/api/v1/local/acp';

export enum Line {
  User = 'user',
  Agent = 'agent',
  Tool = 'tool',
  Permission = 'permission',
  Error = 'error'
}

export type ChatLine =
  | { line: Line.User | Line.Agent | Line.Error; text: string }
  | { line: Line.Tool; title: string }
  | { line: Line.Permission; id: string; title: string; options: AcpOption[]; chosen: string | null };

type PermissionLine = Extract<ChatLine, { line: Line.Permission }>;

const ANSWER_FAILED = 'The agent did not get your answer. Try again.';

const UPDATE_LINES: Record<string, (update: AcpUpdate, chat: AcpChat) => void> = {
  agent_message_chunk: (u, chat) => chat.appendAgentText(u.content?.type === 'text' ? (u.content.text ?? '') : ''),
  tool_call: (u, chat) => chat.push({ line: Line.Tool, title: u.title ?? '' })
};

export class AcpChat {
  lines = $state<ChatLine[]>([]);
  busy = $state(false);

  constructor(public fetcher: typeof fetch = fetch) {}

  push(line: ChatLine) {
    this.lines.push(line);
  }

  appendAgentText(text: string) {
    const last = this.lines.at(-1);
    if (last?.line === Line.Agent) {
      last.text += text;
      return;
    }

    this.push({ line: Line.Agent, text });
  }

  async send(agent: AcpAgent, prompt: string) {
    this.push({ line: Line.User, text: prompt });
    this.busy = true;

    try {
      const res = await this.post({ agent, prompt });
      for await (const event of readAcpEvents(res.body!)) {
        this.receive(event);
      }
    } catch (e) {
      this.push({ line: Line.Error, text: (e as Error).message });
    }

    this.busy = false;
  }

  async answer(id: string, optionId: string) {
    const asked = this.lines.find((l): l is PermissionLine => l.line === Line.Permission && l.id === id);
    if (!asked || asked.chosen !== null) {
      return;
    }

    asked.chosen = optionId;
    const res = await this.post({ permission: { id, optionId } }).catch(() => null);
    if (res?.ok) {
      return;
    }

    asked.chosen = null;
    this.push({ line: Line.Error, text: ANSWER_FAILED });
  }

  private receive(event: AcpEvent) {
    if (event.kind === AcpEventKind.Update) {
      UPDATE_LINES[event.update.sessionUpdate]?.(event.update, this);
      return;
    }

    if (event.kind === AcpEventKind.Permission) {
      this.push({ line: Line.Permission, id: event.id, title: event.title, options: event.options, chosen: null });
      return;
    }

    if (event.kind === AcpEventKind.Failed) {
      this.push({ line: Line.Error, text: event.message });
    }
  }

  private post(body: unknown) {
    return this.fetcher(ACP_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  }
}
