import { applyChatStreamEvent, closeDanglingToolCalls, emptyStreamState, readSseEvents, type ChatStreamState } from '$lib/chat-stream-events';
import { failureOfStatus, type Failure, type ToolCall } from './chat-view';
import type { ChatAttachment } from '$lib/chat-attachments';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
  at?: number | null;
  tools?: ToolCall[];
  attachments?: ChatAttachment[];
  reasoning?: string;
  live?: boolean;
  streaming?: true;
};

export type UserEcho = 'append-user' | 'reuse-user';

export type StreamData = { type: string; data: unknown };

const DATA_PREFIX = 'data-';

const HTTP_NOT_FOUND = 404;
const FOLLOW_POLL_MS = 3000;
const SILENT_TOOLS = new Set(['reply']);

const turns = $state({ running: 0 });

type FailureBody = { error?: string; code?: string };

type SavedThread = { messages?: ChatMessage[]; running?: boolean; parts?: StreamData[] };

const sleep = (ms: number, wake: (resolve: () => void) => void) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    wake(() => {
      clearTimeout(timer);
      resolve();
    });
  });

const livePlaceholder = (partial: ChatMessage | null): ChatMessage => ({ role: 'assistant', content: partial?.content ?? '', reasoning: partial?.reasoning, tools: partial?.tools ?? [], pending: true, live: true, at: partial?.at ?? Date.now() });

const hasWork = (m: ChatMessage | undefined) => Boolean(m?.content || m?.tools?.length);

function following(saved: ChatMessage[], partial: ChatMessage | null): ChatMessage[] {
  const last = saved.at(-1);
  if (last?.streaming && hasWork(last)) {
    return [...saved.slice(0, -1), livePlaceholder({ ...last, reasoning: partial?.reasoning })];
  }
  const settled = last?.streaming ? saved.slice(0, -1) : saved;
  return [...settled, livePlaceholder(partial)];
}

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
  reconnecting = $state(false);
  loading = $state(true);
  failed = $state<Failure | ''>('');
  failedDetail = $state('');
  revision = $state(0);
  context: () => Record<string, unknown> = () => ({});
  onTurnEnd: (() => void) | null = null;
  onData: ((part: StreamData) => void) | null = null;

  #abort: AbortController | null = null;
  #wake: () => void = () => {};
  #following = false;
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
      const data = (await res.json()) as SavedThread;
      if (!this.sending && !this.reconnecting) {
        this.messages = data.running ? following(data.messages ?? [], null) : (data.messages ?? []);
      }
      this.#replay(data);
      if (data.running && !this.sending) {
        void this.#follow(null);
      }
    } catch {
      this.failed = 'load';
    } finally {
      this.loading = false;
      this.revision++;
    }
  }

  async send(text: string, echo: UserEcho, attachments: ChatAttachment[] = []) {
    if ((!text && !attachments.length) || this.sending || this.reconnecting) {
      return;
    }

    this.failed = '';
    this.failedDetail = '';
    this.sending = true;
    turns.running++;
    this.#abort = new AbortController();

    if (echo === 'append-user') {
      this.messages = [...this.messages, { role: 'user', content: text, at: Date.now(), ...(attachments.length ? { attachments } : {}) }];
    }
    this.messages = [...this.messages, { role: 'assistant', content: '', pending: true, at: Date.now(), tools: [], live: true }];
    this.revision++;

    try {
      const res = await this.#fetch(this.#endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...this.context(), message: text, ...(attachments.length ? { attachments: attachments.map((a) => a.assetId) } : {}) }),
        signal: this.#abort.signal
      });
      if (!res.ok || !res.body) {
        throw new HttpFailure(res.status, await failureBody(res));
      }

      await this.#stream(res);
      this.#settleDone();
    } catch (e) {
      this.#settleAfter(e, text);
    } finally {
      this.sending = false;
      turns.running--;
      this.#abort = null;
      this.revision++;
      if (!this.#following) {
        this.onTurnEnd?.();
      }
    }
  }

  retry() {
    if (this.failed === 'load') {
      void this.load();
      return;
    }
    const lastUser = [...this.messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      void this.send(lastUser.content, 'reuse-user', lastUser.attachments ?? []);
    }
  }

  stop() {
    const running = this.sending || this.#following;
    const followed = this.#following;
    this.#abort?.abort();
    this.#following = false;
    this.reconnecting = false;
    this.#wake();
    if (!running) {
      return;
    }
    void this.#fetch(this.#endpoint, { method: 'DELETE' }).catch(() => undefined);
    if (followed) {
      this.#settleStopped();
      this.onTurnEnd?.();
    }
  }

  #settleStopped() {
    const partial = this.#lastAssistant();
    if (!partial?.live) {
      return;
    }
    if (!hasWork(partial)) {
      this.messages = this.messages.slice(0, -1);
      return;
    }
    partial.live = false;
    partial.pending = false;
  }

  #replay(thread: SavedThread) {
    if (!thread.running) {
      return;
    }
    for (const part of thread.parts ?? []) {
      this.onData?.(part);
    }
  }

  resume() {
    if (this.#following) {
      this.#wake();
      return;
    }
    if (this.failed === 'load') {
      void this.load();
    }
  }

  async #follow(sent: string | null) {
    if (this.#following) {
      this.#wake();
      return;
    }
    this.#following = true;
    this.reconnecting = true;
    this.failed = '';

    while (this.#following) {
      const thread = await this.#saved();
      if (!this.#following) {
        break;
      }
      if (thread && !thread.running) {
        this.#landed(thread.messages ?? [], sent);
        break;
      }
      if (thread) {
        this.messages = following(thread.messages ?? [], this.#lastAssistant());
        this.#replay(thread);
        this.revision++;
      }
      await sleep(FOLLOW_POLL_MS, (wake) => (this.#wake = wake));
    }

    this.#following = false;
    this.reconnecting = false;
    this.revision++;
  }

  async #saved(): Promise<SavedThread | null> {
    try {
      const res = await this.#fetch(this.#endpoint);
      return res.ok ? ((await res.json()) as SavedThread) : null;
    } catch {
      return null;
    }
  }

  #landed(saved: ChatMessage[], sent: string | null) {
    const lastUser = [...saved].reverse().find((m) => m.role === 'user');
    const unanswered = saved.at(-1)?.role === 'user';
    const lost = sent !== null && lastUser?.content !== sent;

    this.messages = lost ? [...saved, { role: 'user', content: sent, at: Date.now() }] : saved;
    if (unanswered || lost) {
      this.failed = 'send';
      return;
    }
    this.onTurnEnd?.();
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
    last.reasoning = state.reasoning;
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

  #settleAfter(e: unknown, sent: string) {
    const partial = this.#lastAssistant();
    const aborted = (e as Error | undefined)?.name === 'AbortError';

    if (!aborted && !(e instanceof HttpFailure)) {
      void this.#follow(sent);
      return;
    }

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
