import { applyChatStreamEvent, closeDanglingToolCalls, emptyStreamState, readSseEvents, type ChatStreamState } from '$lib/chat-stream-events';
import { failureOfStatus, type Failure, type ToolCall } from './chat-view';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
  at?: number | null;
  tools?: ToolCall[];
  live?: boolean;
};

export type UserEcho = 'append-user' | 'reuse-user';

export type StreamData = { type: string; data: unknown };

const DATA_PREFIX = 'data-';

const HTTP_NOT_FOUND = 404;
const SILENT_TOOLS = new Set(['reply']);

const turns = $state({ running: 0 });

type FailureBody = { error?: string; code?: string };

class HttpFailure extends Error {
  status: number;
  body: FailureBody;
  constructor(status: number, body: FailureBody = {}) {
    super(String(status));
    this.status = status;
    this.body = body;
  }
}

async function failureBody(res: Response): Promise<FailureBody> {
  return ((await res.json().catch(() => ({}))) ?? {}) as FailureBody;
}

export class ChatSession {
  messages = $state<ChatMessage[]>([]);
  sending = $state(false);
  loading = $state(true);
  failed = $state<Failure | ''>('');
  failedDetail = $state('');
  revision = $state(0);
  context: () => Record<string, unknown> = () => ({});
  onTurnEnd: (() => void) | null = null;
  onData: ((part: StreamData) => void) | null = null;

  #abort: AbortController | null = null;
  readonly #endpoint: string;
  readonly #fetch: typeof fetch;

  constructor(endpoint: string, fetcher: typeof fetch) {
    this.#endpoint = endpoint;
    this.#fetch = fetcher;
  }

  async load() {
    if (this.sending) {
      return;
    }

    this.loading = true;
    this.failed = '';

    try {
      const res = await this.#fetch(this.#endpoint);
      if (res.status === HTTP_NOT_FOUND) {
        this.messages = [];
        return;
      }
      if (!res.ok) {
        throw new HttpFailure(res.status);
      }
      const data = (await res.json()) as { messages?: ChatMessage[] };
      if (!this.sending) {
        this.messages = data.messages ?? [];
      }
    } catch {
      this.failed = 'load';
    } finally {
      this.loading = false;
      this.revision++;
    }
  }

  async send(text: string, echo: UserEcho) {
    if (!text || this.sending) {
      return;
    }

    this.failed = '';
    this.failedDetail = '';
    this.sending = true;
    turns.running++;
    this.#abort = new AbortController();

    if (echo === 'append-user') {
      this.messages = [...this.messages, { role: 'user', content: text, at: Date.now() }];
    }
    this.messages = [...this.messages, { role: 'assistant', content: '', pending: true, at: Date.now(), tools: [], live: true }];
    this.revision++;

    try {
      const res = await this.#fetch(this.#endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...this.context(), message: text }),
        signal: this.#abort.signal
      });
      if (!res.ok || !res.body) {
        throw new HttpFailure(res.status, await failureBody(res));
      }

      await this.#stream(res);
      this.#settleDone();
    } catch (e) {
      this.#settleAfter(e);
    } finally {
      this.sending = false;
      turns.running--;
      this.#abort = null;
      this.revision++;
      this.onTurnEnd?.();
    }
  }

  retry() {
    if (this.failed === 'load') {
      void this.load();
      return;
    }
    const lastUser = [...this.messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      void this.send(lastUser.content, 'reuse-user');
    }
  }

  stop() {
    this.#abort?.abort();
  }

  #lastAssistant(): ChatMessage | null {
    const last = this.messages[this.messages.length - 1];
    return last?.role === 'assistant' ? last : null;
  }

  #foldLive(state: ChatStreamState) {
    const last = this.#lastAssistant();
    if (!last) {
      return;
    }
    last.content = state.text;
    last.pending = !state.text;
    last.tools = state.tools
      .filter((t) => !SILENT_TOOLS.has(t.toolName))
      .map((t) => ({ toolCallId: t.toolCallId, toolName: t.toolName, status: t.status, input: t.input, output: t.output, errorText: t.errorText }));
  }

  async #stream(res: Response) {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const state = emptyStreamState();
    let buffered = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffered += decoder.decode(value, { stream: true });
      const { events, rest } = readSseEvents(buffered);
      buffered = rest;
      for (const evt of events) {
        this.#announce(evt);
        if (applyChatStreamEvent(state, evt)) {
          this.#foldLive(state);
        }
      }
      this.revision++;
    }

    closeDanglingToolCalls(state);
    this.#foldLive(state);
  }

  #announce(evt: unknown) {
    const e = evt as { type?: string; data?: unknown };
    if (!e.type?.startsWith(DATA_PREFIX)) {
      return;
    }
    this.onData?.({ type: e.type, data: e.data });
  }

  #settleDone() {
    const done = this.#lastAssistant();
    if (done) {
      done.live = false;
      done.pending = false;
    }
    if (!done?.content && !done?.tools?.length) {
      this.messages = this.messages.slice(0, -1);
      this.failed = 'empty';
    }
  }

  #settleAfter(e: unknown) {
    const partial = this.#lastAssistant();
    const aborted = (e as Error | undefined)?.name === 'AbortError';

    if (aborted && partial && (partial.content || partial.tools?.length)) {
      partial.live = false;
      partial.pending = false;
      return;
    }

    this.messages = this.messages.slice(0, -1);
    if (aborted) {
      return;
    }
    this.failed = e instanceof HttpFailure ? failureOfStatus(e.status, e.body.code) : 'send';
    this.failedDetail = e instanceof HttpFailure ? (e.body.error ?? '') : '';
  }
}

const sessions = new Map<string, ChatSession>();

export function chatSession(endpoint: string, fetcher: typeof fetch = fetch): ChatSession {
  const existing = sessions.get(endpoint);
  if (existing) {
    return existing;
  }
  const created = new ChatSession(endpoint, fetcher);
  sessions.set(endpoint, created);
  return created;
}

export function anyChatRunning(): boolean {
  return turns.running > 0;
}

export function forgetChatSessions() {
  sessions.clear();
  turns.running = 0;
}
