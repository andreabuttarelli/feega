export type PersonName = { first: string; last: string };

type AuthMetadata = {
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
};

const NO_NAME: PersonName = { first: '', last: '' };
const NAMED_PROVIDERS: readonly string[] = ['google', 'apple'];
const FULL_NAME_KEYS = ['full_name', 'name'] as const;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function splitOnLastSpace(full: string): PersonName {
  const at = full.lastIndexOf(' ');
  if (at === -1) {
    return { first: full, last: '' };
  }

  return { first: full.slice(0, at).trim(), last: full.slice(at + 1).trim() };
}

export function namesFromAuth(user: AuthMetadata): PersonName {
  const provider = text(user.app_metadata?.provider);
  if (!NAMED_PROVIDERS.includes(provider)) {
    return NO_NAME;
  }

  const metadata = user.user_metadata ?? {};
  const first = text(metadata.given_name);
  const last = text(metadata.family_name);
  if (first || last) {
    return { first, last };
  }

  const full = FULL_NAME_KEYS.map((key) => text(metadata[key])).find(Boolean) ?? '';
  return splitOnLastSpace(full);
}

const GITHUB = 'github';
const GITHUB_HANDLE_KEYS = ['user_name', 'preferred_username'] as const;

export function isGithubProvider(user: AuthMetadata): boolean {
  return text(user.app_metadata?.provider) === GITHUB;
}

export function isGithubNickname(user: AuthMetadata, storedName: string): boolean {
  if (!isGithubProvider(user)) {
    return false;
  }

  const stored = storedName.trim().toLowerCase();
  const metadata = user.user_metadata ?? {};
  const handles = GITHUB_HANDLE_KEYS.map((key) => text(metadata[key]).toLowerCase());
  const singleWord = !stored.includes(' ');

  return handles.includes(stored) || (singleWord && FULL_NAME_KEYS.some((key) => text(metadata[key]).toLowerCase() === stored));
}
