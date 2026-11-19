import { COFFEE_URL, EDITORS, EXTENSION_PUBLISHED, GITHUB_URL, MARKETPLACE_URL, NPX_COMMAND, NPX_LISTED, type Editor } from './links';

const DOWNLOAD_LABEL = 'Download for free';

export const DEEP_LINK_TIMEOUT_MS = 1500;

export const PRIMARY_EDITOR = EDITORS[0];

export type Cta = { label: string; href: string; deepLink?: string };

export type Env = {
  userAgent: string;
  open: (url: string) => void;
  hidden: () => boolean;
  later: (fn: () => void, ms: number) => void;
};

export const primaryCta = (published: boolean = EXTENSION_PUBLISHED): Cta =>
  published
    ? { label: DOWNLOAD_LABEL, href: MARKETPLACE_URL, deepLink: PRIMARY_EDITOR.installUrl }
    : { label: DOWNLOAD_LABEL, href: GITHUB_URL };

export const starCta: Cta = { label: 'Star on GitHub', href: GITHUB_URL };

export const secondaryCtas = (): readonly Cta[] => [{ label: 'Support with a coffee', href: COFFEE_URL }];

export type InstallOption = { label: string; href: string; deepLink?: string; command?: string; soon: boolean };

export const installOptions = (published: boolean = EXTENSION_PUBLISHED): readonly InstallOption[] => [
  ...EDITORS.map((e: Editor) => ({
    label: e.label,
    href: e.webUrl,
    deepLink: e.installUrl === e.webUrl ? undefined : e.installUrl,
    soon: !published || !e.listed
  })),
  { label: 'Terminal', href: GITHUB_URL, command: NPX_COMMAND, soon: !published || !NPX_LISTED }
];

export const isMobile = (userAgent: string): boolean => /android|iphone|ipad|ipod/i.test(userAgent);

export const follow = (cta: Cta, env: Env): void => {
  if (!cta.deepLink || isMobile(env.userAgent)) {
    env.open(cta.href);
    return;
  }

  env.open(cta.deepLink);
  env.later(() => {
    if (!env.hidden()) {
      env.open(cta.href);
    }
  }, DEEP_LINK_TIMEOUT_MS);
};

const browserEnv = (): Env => ({
  userAgent: navigator.userAgent,
  open: (url) => {
    window.location.href = url;
  },
  hidden: () => document.hidden,
  later: (fn, ms) => {
    setTimeout(fn, ms);
  }
});

export const installAction = (node: HTMLAnchorElement, cta: Cta) => {
  if (!cta.deepLink) {
    return {};
  }

  const onClick = (event: MouseEvent) => {
    event.preventDefault();
    follow(cta, browserEnv());
  };
  node.addEventListener('click', onClick);

  return { destroy: () => node.removeEventListener('click', onClick) };
};
