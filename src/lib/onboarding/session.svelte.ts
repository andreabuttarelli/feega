import { Account, Arrival, ENDPOINTS, FlowEvent, LOCAL_ACCOUNT_PATH, LOCAL_ONBOARDING_PATH, LOCAL_SOURCES_PATH, STEPS, Step, Surface, localViewer, progressOf, stepsFor, type LocalOnboarding, type MemorySource, type Viewer } from './flow';

export type Answer = { status: number; body: unknown };
export type Call = (path: string, init?: RequestInit) => Promise<Answer>;

export enum Connection {
  Idle = 'idle',
  Waiting = 'waiting',
  Failed = 'failed'
}

export enum Unsaved {
  Name = 'Your name was not saved. Set it later in Settings.',
  Memory = 'Your memory was not saved. Paste it again from Settings.'
}

type Ports = {
  call: Call;
  remember: () => Promise<void>;
  track: (event: FlowEvent, props: Record<string, unknown>) => void;
  open: (url: string) => void;
  wait: (ms: number) => Promise<void>;
};

const JSON_HEADERS = { 'content-type': 'application/json' };
const POLL_MS = 2000;
const POLL_TRIES = 150;
const OK_BELOW = 300;

const put = (body: unknown): RequestInit => ({ method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(body) });
const post = (body: unknown): RequestInit => ({ method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
const failed = (answer: Answer | null) => !answer || answer.status >= OK_BELOW;

export class OnboardingSession {
  viewer = $state<Viewer | null>(null);
  plan = $state<Step[]>([]);
  step = $state<Step | null>(null);
  connection = $state<Connection>(Connection.Idle);
  sources = $state<MemorySource[]>([]);
  unsaved = $state<Unsaved | null>(null);
  email = $state<string | null>(null);
  cloud = $state<string | null>(null);

  index = $derived(this.step ? this.plan.indexOf(this.step) : -1);
  progress = $derived(progressOf(this.index, this.plan.length));
  first = $derived(this.index === 0);

  constructor(private ports: Ports) {}

  begin(viewer: Viewer) {
    this.viewer = viewer;
    this.plan = stepsFor(viewer);
    this.show(this.plan[0] ?? null);
  }

  async beginLocal() {
    const state = await this.localState();
    if (!state) {
      return;
    }

    this.email = state.account?.email ?? null;
    this.cloud = state.cloud;
    this.begin(localViewer(state));
    void this.findSources();
  }

  next() {
    const following = this.plan[this.index + 1] ?? null;
    if (!following) {
      this.finish(FlowEvent.Finish);
      return;
    }

    this.show(following);
  }

  back() {
    this.show(this.plan[this.index - 1] ?? this.step);
  }

  skip() {
    this.finish(FlowEvent.Skip);
  }

  saveName(name: string) {
    const viewer = this.viewer;
    if (!viewer) {
      return;
    }

    this.viewer = { ...viewer, name };
    this.next();
    void this.save(ENDPOINTS[viewer.surface].profile, { name }, Unsaved.Name);
  }

  saveMemory(content: string) {
    const viewer = this.viewer;
    if (!viewer) {
      return;
    }

    this.next();
    void this.save(ENDPOINTS[viewer.surface].memory, { content }, Unsaved.Memory);
  }

  async connect() {
    this.connection = Connection.Waiting;

    const answer = await this.ports.call(LOCAL_ACCOUNT_PATH, { method: 'POST' }).catch(() => null);
    const url = failed(answer) ? null : (answer?.body as { url?: string }).url;
    if (!url) {
      this.connection = Connection.Failed;
      return;
    }

    this.ports.open(url);
    this.connection = (await this.awaitAccount()) ? Connection.Idle : Connection.Failed;
  }

  openCloud() {
    if (this.cloud) {
      this.ports.open(this.cloud);
    }
    this.next();
  }

  async readSources(ids: string[]): Promise<string> {
    const answer = await this.ports.call(LOCAL_SOURCES_PATH, post({ ids })).catch(() => null);
    return failed(answer) ? '' : ((answer?.body as { content?: string }).content ?? '');
  }

  private show(step: Step | null) {
    this.step = step;
    if (step) {
      this.ports.track(FlowEvent.Step, { step, surface: this.viewer?.surface });
    }
  }

  private finish(event: FlowEvent) {
    this.ports.track(event, { step: this.step, surface: this.viewer?.surface });
    this.step = null;

    if (this.viewer?.arrival === Arrival.FirstRun) {
      void this.ports.remember();
    }
  }

  private async save(path: string, body: unknown, notice: Unsaved) {
    const answer = await this.ports.call(path, put(body)).catch(() => null);
    if (failed(answer)) {
      this.unsaved = notice;
    }
  }

  private async localState(): Promise<LocalOnboarding | null> {
    const answer = await this.ports.call(LOCAL_ONBOARDING_PATH).catch(() => null);
    return failed(answer) ? null : (answer?.body as LocalOnboarding);
  }

  private async findSources() {
    const answer = await this.ports.call(LOCAL_SOURCES_PATH).catch(() => null);
    this.sources = failed(answer) ? [] : ((answer?.body as { sources?: MemorySource[] }).sources ?? []);
  }

  private async awaitAccount(): Promise<boolean> {
    for (let attempt = 0; attempt < POLL_TRIES; attempt += 1) {
      await this.ports.wait(POLL_MS);

      const state = await this.localState();
      if (state?.account) {
        this.joined(state);
        return true;
      }
    }

    return false;
  }

  private joined(state: LocalOnboarding) {
    const viewer: Viewer = { surface: Surface.Local, arrival: Arrival.FirstRun, account: Account.SignedIn, name: state.account?.name ?? null };
    const wanted = stepsFor(viewer);
    const passed = this.plan.slice(0, this.index + 1);

    this.email = state.account?.email ?? null;
    this.viewer = viewer;
    this.plan = STEPS.map((row) => row.step).filter((step) => passed.includes(step) || wanted.includes(step));
  }
}
