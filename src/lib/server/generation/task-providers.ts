export enum TaskProviderName {
  Wiro = 'wiro',
  Kie = 'kie',
  Higgsfield = 'higgsfield'
}

export enum RouteRole {
  Primary = 'primary',
  Discount = 'discount'
}

export type TaskMedium = 'image' | 'video' | 'model3d';

type ProviderFacts = {
  label: string;
  role: RouteRole;
  envKeys: readonly string[];
  priceSource: string;
  storageFolder: string;
  fallbackAfterMs?: Readonly<Record<TaskMedium, number>>;
};

const MINUTE_MS = 60_000;

export const TASK_PROVIDERS: Readonly<Record<TaskProviderName, ProviderFacts>> = {
  [TaskProviderName.Wiro]: {
    label: 'Wiro',
    role: RouteRole.Primary,
    envKeys: ['WIRO_API_KEY'],
    priceSource: 'Wiro /Tool/List dynamicprice, per model',
    storageFolder: 'wiro'
  },
  [TaskProviderName.Kie]: {
    label: 'kie.ai',
    role: RouteRole.Discount,
    envKeys: ['KIE_API_KEY'],
    priceSource: 'https://kie.ai/pricing, checked against recordInfo creditsConsumed',
    storageFolder: 'kie',
    fallbackAfterMs: { image: 3 * MINUTE_MS, video: 15 * MINUTE_MS, model3d: 15 * MINUTE_MS }
  },
  [TaskProviderName.Higgsfield]: {
    label: 'Higgsfield',
    role: RouteRole.Primary,
    envKeys: ['HIGGSFIELD_API_KEY_ID', 'HIGGSFIELD_API_KEY_SECRET'],
    priceSource: 'Higgsfield POST /estimate/<model>, per variant',
    storageFolder: 'higgsfield'
  }
};

const PROVIDER_NAMES = Object.values(TaskProviderName);

export const idPrefixOf = (provider: TaskProviderName): string => `${provider}/`;

export const jobPrefixOf = (provider: TaskProviderName): string => `${provider}:`;

export const TASK_JOB_PREFIXES: readonly string[] = PROVIDER_NAMES.map(jobPrefixOf);

export function taskProviderOf(modelId: string | null | undefined): TaskProviderName | null {
  return PROVIDER_NAMES.find((provider) => modelId?.startsWith(idPrefixOf(provider))) ?? null;
}

export function taskJobOf(externalJobId: string): { provider: TaskProviderName; taskId: string } | null {
  const provider = PROVIDER_NAMES.find((name) => externalJobId.startsWith(jobPrefixOf(name)));
  return provider ? { provider, taskId: externalJobId.slice(jobPrefixOf(provider).length) } : null;
}

export function configuredIn(env: Readonly<Record<string, string | undefined>>): ReadonlySet<TaskProviderName> {
  return new Set(PROVIDER_NAMES.filter((provider) => TASK_PROVIDERS[provider].envKeys.every((key) => env[key]?.trim())));
}
