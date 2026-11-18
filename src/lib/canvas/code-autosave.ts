export const AUTOSAVE_IDLE_MS = 3_000;

export enum AutosaveState {
  Idle = 'idle',
  Pending = 'pending',
  Saving = 'saving',
  Saved = 'saved',
  Conflict = 'conflict',
  Paused = 'paused',
  Failed = 'failed'
}

const STATE_OF_REFUSAL: Record<string, AutosaveState> = {
  diverged: AutosaveState.Conflict,
  branch_gone: AutosaveState.Conflict,
  no_files: AutosaveState.Saved,
  no_changes: AutosaveState.Saved,
  needs_confirm: AutosaveState.Paused,
  variant_choice: AutosaveState.Paused,
  env_file: AutosaveState.Paused,
  secret: AutosaveState.Paused,
  read_only: AutosaveState.Paused,
  busy: AutosaveState.Pending
};

const STOPS = new Set([AutosaveState.Conflict, AutosaveState.Paused]);

export const outcomeOf = (body: { ok?: boolean; refusal?: string } | null): AutosaveState => {
  if (!body) {
    return AutosaveState.Failed;
  }
  if (body.ok) {
    return AutosaveState.Saved;
  }
  return STATE_OF_REFUSAL[String(body.refusal)] ?? AutosaveState.Failed;
};

export type AutosaveDeps = {
  save: (nodeIds: string[]) => Promise<AutosaveState>;
  onstate: (state: AutosaveState) => void;
};

export function codeAutosave(deps: AutosaveDeps) {
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let saving = false;
  let stopped = false;

  const schedule = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => void flush(), AUTOSAVE_IDLE_MS);
  };

  const flush = async () => {
    timer = null;
    if (saving || stopped || !pending.size) {
      return;
    }
    const batch = [...pending];
    pending.clear();
    saving = true;
    deps.onstate(AutosaveState.Saving);
    const state = await deps.save(batch).catch(() => AutosaveState.Failed);
    saving = false;
    deps.onstate(state);

    if (state === AutosaveState.Pending) {
      batch.forEach((id) => pending.add(id));
    }
    stopped = STOPS.has(state);
    if (pending.size && !stopped) {
      schedule();
    }
  };

  return {
    touch: (nodeId: string) => {
      pending.add(nodeId);
      if (stopped) {
        return;
      }
      if (!saving) {
        deps.onstate(AutosaveState.Pending);
      }
      schedule();
    },
    resume: () => {
      stopped = false;
      schedule();
    },
    stop: () => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = null;
    }
  };
}
