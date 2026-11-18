import { ACP_ENDPOINT } from './acp-chat.svelte';
import { encodeAcpEvent, AcpEventKind, type AcpEvent } from './acp-events';
import { ACP_AGENTS_ENDPOINT, type DetectedAgent } from './detected-agent';

export enum AgentSurface {
  LocalFile = 'local_file',
  DesktopHosted = 'desktop_hosted',
  Browser = 'browser'
}

export enum AgentTransport {
  Http = 'http',
  Ipc = 'ipc',
  None = 'none'
}

export const TRANSPORT_OF: Record<AgentSurface, AgentTransport> = {
  [AgentSurface.LocalFile]: AgentTransport.Http,
  [AgentSurface.DesktopHosted]: AgentTransport.Ipc,
  [AgentSurface.Browser]: AgentTransport.None
};

const DESKTOP_MARK = 'FeegaNative/';
const LOCAL_FLAG = 'PUBLIC_FEEGA_LOCAL';
const FRESH_QUERY = 'refresh=1';
const NOT_FOUND = 404;
const NO_CONTENT = 204;
const ABORT_ERROR = 'AbortError';

export function surfaceOf(env: Record<string, string | undefined>, userAgent: string): AgentSurface {
  if (env[LOCAL_FLAG] === '1') {
    return AgentSurface.LocalFile;
  }

  return userAgent.includes(DESKTOP_MARK) ? AgentSurface.DesktopHosted : AgentSurface.Browser;
}

export type TurnContext = { projectId: string; token: string };

export type LocalAgentsBridge = {
  protocol: number;
  list: (refresh: 'cached' | 'fresh') => Promise<{ agents: DetectedAgent[]; chosen: string | null }>;
  choose: (id: string | null) => Promise<void>;
  start: (turn: { turnId: string; agent: string; prompt: string; projectId: string; token: string }) => Promise<void>;
  answer: (answer: { turnId: string; id: string; optionId: string }) => Promise<boolean>;
  cancel: (turnId: string) => Promise<void>;
  onEvent: (listener: (turnId: string, event: AcpEvent) => void) => () => void;
};

type Deps = { bridge: LocalAgentsBridge | undefined; context: () => Promise<TurnContext> };

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
const status = (code: number) => new Response(null, { status: code });
const bodyOf = (init?: RequestInit) => JSON.parse(String(init?.body ?? '{}'));
const ended = (event: AcpEvent) => event.kind === AcpEventKind.Done || event.kind === AcpEventKind.Failed;

function streamTurn(bridge: LocalAgentsBridge, turnId: string, begin: () => Promise<void>, signal?: AbortSignal) {
  const encoder = new TextEncoder();
  let off = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const finish = () => {
        off();
        controller.close();
      };

      off = bridge.onEvent((id, event) => {
        if (id !== turnId) {
          return;
        }

        controller.enqueue(encoder.encode(encodeAcpEvent(event)));
        if (ended(event)) {
          finish();
        }
      });

      signal?.addEventListener('abort', () => {
        off();
        void bridge.cancel(turnId);
        controller.error(new DOMException('stopped', ABORT_ERROR));
      }, { once: true });

      begin().catch((e: Error) => {
        controller.enqueue(encoder.encode(encodeAcpEvent({ kind: AcpEventKind.Failed, message: e.message })));
        finish();
      });
    }
  });

  return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
}

function ipcFetch({ bridge, context }: { bridge: LocalAgentsBridge; context: Deps['context'] }): typeof fetch {
  let current = '';

  return async (input, init) => {
    const url = new URL(String(input), 'http://local');
    const method = init?.method ?? 'GET';

    if (url.pathname === ACP_AGENTS_ENDPOINT && method === 'GET') {
      return json(await bridge.list(url.search.includes(FRESH_QUERY) ? 'fresh' : 'cached'));
    }

    if (url.pathname === ACP_AGENTS_ENDPOINT && method === 'PUT') {
      await bridge.choose(bodyOf(init).agent);
      return status(NO_CONTENT);
    }

    if (url.pathname === ACP_ENDPOINT && method === 'POST') {
      const body = bodyOf(init);
      if (body.permission) {
        const ok = await bridge.answer({ turnId: current, ...body.permission });
        return status(ok ? NO_CONTENT : NOT_FOUND);
      }

      current = crypto.randomUUID();
      const start = async () => bridge.start({ turnId: current, agent: body.agent, prompt: body.prompt, ...(await context()) });
      return streamTurn(bridge, current, start, init?.signal ?? undefined);
    }

    return status(NOT_FOUND);
  };
}

export function agentFetch(transport: AgentTransport, deps: Deps): typeof fetch | null {
  if (transport === AgentTransport.Http) {
    return fetch;
  }

  if (transport === AgentTransport.Ipc && deps.bridge) {
    return ipcFetch({ bridge: deps.bridge, context: deps.context });
  }

  return null;
}
