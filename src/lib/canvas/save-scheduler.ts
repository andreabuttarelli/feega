import type { NodeData } from './node-patch';

export enum SendResult {
  Saved = 'saved',
  Retry = 'retry',
  Dropped = 'dropped'
}

export enum SaveStatus {
  Saved = 'saved',
  Saving = 'saving',
  Retrying = 'retrying'
}

export enum SaveTiming {
  Debounced = 'debounced',
  Now = 'now'
}

type Waiter = (saved: boolean) => void;

type NodeSaves = {
  pending: NodeData | null;
  pendingWaiters: Waiter[];
  inflight: NodeData | null;
  inflightWaiters: Waiter[];
  firstEditAt: number | null;
  timer: ReturnType<typeof setTimeout> | null;
  failures: number;
};

type SchedulerOptions = {
  send: (id: string, patch: NodeData) => Promise<SendResult>;
  debounceMs: number;
  maxWaitMs: number;
  backoffMs: (failures: number) => number;
  onStatus?: (status: SaveStatus) => void;
};

export function createSaveScheduler(options: SchedulerOptions) {
  const nodes = new Map<string, NodeSaves>();
  const held = new Set<string>();
  let lastStatus = SaveStatus.Saved;

  function stateOf(id: string): NodeSaves {
    const known = nodes.get(id);
    if (known) {
      return known;
    }
    const fresh: NodeSaves = {
      pending: null, pendingWaiters: [], inflight: null, inflightWaiters: [], firstEditAt: null, timer: null, failures: 0
    };
    nodes.set(id, fresh);
    return fresh;
  }

  function status(): SaveStatus {
    const states = [...nodes.values()];
    if (states.some((s) => s.failures > 0)) {
      return SaveStatus.Retrying;
    }
    if (states.some((s) => s.pending || s.inflight)) {
      return SaveStatus.Saving;
    }
    return SaveStatus.Saved;
  }

  function announce() {
    const now = status();
    if (now === lastStatus) {
      return;
    }
    lastStatus = now;
    options.onStatus?.(now);
  }

  function arm(id: string, delay: number) {
    const state = stateOf(id);
    if (state.timer) {
      clearTimeout(state.timer);
    }
    state.timer = setTimeout(() => fire(id), Math.max(0, delay));
  }

  function armDebounced(id: string) {
    const state = stateOf(id);
    const now = Date.now();
    state.firstEditAt ??= now;
    arm(id, Math.min(options.debounceMs, state.firstEditAt + options.maxWaitMs - now));
  }

  function settle(waiters: Waiter[], saved: boolean) {
    for (const waiter of waiters) {
      waiter(saved);
    }
  }

  async function fire(id: string) {
    const state = stateOf(id);
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    if (state.inflight || !state.pending || held.has(id)) {
      return;
    }

    state.inflight = state.pending;
    state.inflightWaiters = state.pendingWaiters;
    state.pending = null;
    state.pendingWaiters = [];
    state.firstEditAt = null;
    announce();

    const result = await options.send(id, state.inflight).catch(() => SendResult.Retry);
    const sent = state.inflight;
    const waiters = state.inflightWaiters;
    state.inflight = null;
    state.inflightWaiters = [];

    if (result === SendResult.Retry) {
      state.pending = { ...sent, ...(state.pending ?? {}) };
      state.pendingWaiters = [...waiters, ...state.pendingWaiters];
      state.failures += 1;
      arm(id, options.backoffMs(state.failures));
      announce();
      return;
    }

    state.failures = 0;
    settle(waiters, result === SendResult.Saved);
    if (state.pending) {
      armDebounced(id);
    }
    announce();
  }

  function waitFor(state: NodeSaves): Promise<boolean> {
    return new Promise((resolve) => {
      if (state.pending) {
        state.pendingWaiters.push(resolve);
        return;
      }
      if (state.inflight) {
        state.inflightWaiters.push(resolve);
        return;
      }
      resolve(true);
    });
  }

  function schedule(id: string, patch: NodeData, timing = SaveTiming.Debounced): Promise<boolean> {
    const state = stateOf(id);
    state.pending = { ...(state.pending ?? {}), ...patch };
    const saved = waitFor(state);
    announce();

    if (timing === SaveTiming.Now && !state.inflight) {
      void fire(id);
      return saved;
    }
    if (!state.failures) {
      armDebounced(id);
    }
    return saved;
  }

  async function flush(only?: string): Promise<void> {
    const waits: Promise<boolean>[] = [];
    for (const [id, state] of nodes) {
      if (only && id !== only) {
        continue;
      }
      waits.push(waitFor(state));
      if (state.pending && !state.inflight) {
        void fire(id);
      }
    }
    await Promise.all(waits);
  }

  function dirtyKeys(id: string): string[] {
    const state = nodes.get(id);
    if (!state) {
      return [];
    }
    return [...new Set([...Object.keys(state.inflight ?? {}), ...Object.keys(state.pending ?? {})])];
  }

  function sending(id: string): boolean {
    return Boolean(nodes.get(id)?.inflight);
  }

  function unsent(): boolean {
    return status() !== SaveStatus.Saved;
  }

  function hold(id: string): () => void {
    held.add(id);
    return () => {
      held.delete(id);
      if (nodes.get(id)?.pending) {
        armDebounced(id);
      }
    };
  }

  return { schedule, flush, dirtyKeys, sending, unsent, status, hold };
}
