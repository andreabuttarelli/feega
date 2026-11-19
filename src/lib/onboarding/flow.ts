export enum Surface {
  Web = 'web',
  Desktop = 'desktop',
  Local = 'local'
}

export enum Step {
  Account = 'account',
  Home = 'home',
  Name = 'name',
  Agents = 'agents',
  Memory = 'memory'
}

export enum Arrival {
  FirstRun = 'first_run',
  Returning = 'returning'
}

export enum Account {
  SignedIn = 'signed_in',
  None = 'none'
}

export type Viewer = { surface: Surface; arrival: Arrival; account: Account; name: string | null };

export enum FlowEvent {
  Step = 'onboarding_step_viewed',
  Finish = 'onboarding_finished',
  Skip = 'onboarding_skipped'
}

const DESKTOP_AGENT = 'FeegaNative/';

const firstRun = (viewer: Viewer) => viewer.arrival === Arrival.FirstRun;
const signedIn = (viewer: Viewer) => viewer.account === Account.SignedIn;
const onThisComputer = (viewer: Viewer) => viewer.surface === Surface.Local;

type StepRow = { step: Step; label: string; shows: (viewer: Viewer) => boolean };

export const STEPS: readonly StepRow[] = [
  { step: Step.Account, label: 'sign in', shows: (viewer) => firstRun(viewer) && onThisComputer(viewer) && !signedIn(viewer) },
  { step: Step.Home, label: 'where it runs', shows: (viewer) => firstRun(viewer) && onThisComputer(viewer) },
  { step: Step.Name, label: 'your name', shows: (viewer) => signedIn(viewer) && !viewer.name?.trim() },
  { step: Step.Agents, label: 'your AI', shows: (viewer) => firstRun(viewer) && onThisComputer(viewer) },
  { step: Step.Memory, label: 'your memory', shows: (viewer) => firstRun(viewer) && signedIn(viewer) }
];

export function stepsFor(viewer: Viewer): Step[] {
  return STEPS.filter((row) => row.shows(viewer)).map((row) => row.step);
}

export function labelOf(step: Step): string {
  return STEPS.find((row) => row.step === step)?.label ?? '';
}

export function surfaceOf(input: { local: boolean; userAgent: string }): Surface {
  if (input.local) {
    return Surface.Local;
  }
  return input.userAgent.includes(DESKTOP_AGENT) ? Surface.Desktop : Surface.Web;
}

export function progressOf(index: number, total: number): number {
  return total === 0 ? 1 : (index + 1) / total;
}

type Endpoints = { profile: string; memory: string };

export const ENDPOINTS: Readonly<Record<Surface, Endpoints>> = {
  [Surface.Web]: { profile: '/api/v1/me/profile', memory: '/api/v1/me/memory' },
  [Surface.Desktop]: { profile: '/api/v1/me/profile', memory: '/api/v1/me/memory' },
  [Surface.Local]: { profile: '/api/v1/local/account/profile', memory: '/api/v1/local/account/memory' }
};

export const LOCAL_ONBOARDING_PATH = '/api/v1/local/onboarding';
export const LOCAL_ACCOUNT_PATH = '/api/v1/local/account';
export const LOCAL_SOURCES_PATH = '/api/v1/local/memory-sources';

export type LocalOnboarding = { seenAt: string | null; account: { email: string; name: string | null } | null; cloud: string };

export type MemorySource = { id: string; label: string; path: string; bytes: number };

export function localViewer(state: Pick<LocalOnboarding, 'seenAt' | 'account'>): Viewer {
  return {
    surface: Surface.Local,
    arrival: state.seenAt ? Arrival.Returning : Arrival.FirstRun,
    account: state.account ? Account.SignedIn : Account.None,
    name: state.account?.name ?? null
  };
}

export enum Place {
  Computer = 'computer',
  Cloud = 'cloud'
}

export type Peer = { id: string; name: string };
