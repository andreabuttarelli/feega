import { COFFEE_URL, EDITORS, EXTENSION_PUBLISHED, GITHUB_URL, MARKETPLACE_URL, type Editor } from './links';

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

export const starCta: Cta = { label: 'Star us on GitHub', href: GITHUB_URL };

export const secondaryCtas = (published: boolean = EXTENSION_PUBLISHED): readonly Cta[] =>
  published
    ? EDITORS.slice(1).map((e: Editor) => ({ label: e.label, href: e.installUrl }))
    : [{ label: 'Support with a coffee', href: COFFEE_URL }];

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
