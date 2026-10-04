import type { ChatModelChoice, ChatModelGroup } from '$lib/chat-model';

const ENDPOINT = '/api/v1/chat-models';

export class ChatModelPrefs {
  groups = $state<ChatModelGroup[]>([]);
  choice = $state<ChatModelChoice | null>(null);

  readonly #fetch: typeof fetch;
  #loading: Promise<void> | null = null;

  constructor(fetcher: typeof fetch) {
    this.#fetch = fetcher;
  }

  load(): Promise<void> {
    this.#loading ??= this.#read();
    return this.#loading;
  }

  async choose(next: ChatModelChoice) {
    this.choice = next;
    await this.#fetch(ENDPOINT, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) }).catch(() => undefined);
  }

  turnFields(): Partial<ChatModelChoice> {
    return this.choice ? { ...this.choice } : {};
  }

  async #read() {
    const res = await this.#fetch(ENDPOINT).catch(() => null);
    if (!res?.ok) {
      this.#loading = null;
      return;
    }
    const body = (await res.json()) as { groups: ChatModelGroup[]; choice: ChatModelChoice };
    this.groups = body.groups;
    this.choice ??= body.choice;
  }
}

let shared: ChatModelPrefs | null = null;

export function chatModelPrefs(fetcher: typeof fetch = fetch): ChatModelPrefs {
  shared ??= new ChatModelPrefs(fetcher);
  return shared;
}
