import { isNativeShell } from '$lib/native-shell';

export enum AppleSignInFlag {
  On = 'on',
  Off = 'off'
}

export type AppleSignInContext = { host: string; userAgent: string | null; flag: AppleSignInFlag };

const PRODUCTION_HOSTS = ['feega.app', 'www.feega.app', 'oh.feega.app'];
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const LOCAL_SUFFIX = '.local';

function hostname(host: string): string {
  return host.replace(/:\d+$/, '').toLowerCase();
}

const RULES: { matches: (c: AppleSignInContext) => boolean; shown: boolean }[] = [
  { matches: (c) => PRODUCTION_HOSTS.includes(hostname(c.host)), shown: false },
  { matches: (c) => LOCAL_HOSTS.includes(hostname(c.host)) || hostname(c.host).endsWith(LOCAL_SUFFIX), shown: true },
  { matches: (c) => isNativeShell(c.userAgent) && c.flag === AppleSignInFlag.On, shown: true }
];

export function appleSignInShown(context: AppleSignInContext): boolean {
  return RULES.find((rule) => rule.matches(context))?.shown ?? false;
}

export function appleSignInFlag(value: string | undefined): AppleSignInFlag {
  return value === AppleSignInFlag.On ? AppleSignInFlag.On : AppleSignInFlag.Off;
}
