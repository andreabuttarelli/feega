import { Framework } from './run-plan';

export enum AttachRule {
  Allowed = 'allowed',
  RequiresFeegaStart = 'requires-feega-start'
}

export enum AttachReason {
  SourceLinkNeedsLauncher = 'source-link-needs-launcher'
}

type Row = { attach: AttachRule; reason: AttachReason | null };

const ALLOWED: Row = { attach: AttachRule.Allowed, reason: null };
const LAUNCHER_ONLY: Row = { attach: AttachRule.RequiresFeegaStart, reason: AttachReason.SourceLinkNeedsLauncher };

export const ATTACH_RULE: Record<Framework, Row> = {
  [Framework.SvelteKit]: ALLOWED,
  [Framework.Nuxt]: LAUNCHER_ONLY,
  [Framework.Astro]: LAUNCHER_ONLY,
  [Framework.ReactRouter]: ALLOWED,
  [Framework.Next]: ALLOWED,
  [Framework.Gatsby]: ALLOWED,
  [Framework.Angular]: ALLOWED,
  [Framework.Cra]: ALLOWED,
  [Framework.Vite]: ALLOWED,
  [Framework.Generic]: ALLOWED
};

export const NO_ATTACH_MESSAGE = 'Astro/Nuxt: Feega must start the dev server to link elements to your source files. Stop your running server or let Feega start its own.';

const REASON_TEXT: Record<AttachReason, string> = {
  [AttachReason.SourceLinkNeedsLauncher]: NO_ATTACH_MESSAGE
};

export const attachRefusal = (framework: Framework): string | null => {
  const { reason } = ATTACH_RULE[framework];
  return reason ? REASON_TEXT[reason] : null;
};
