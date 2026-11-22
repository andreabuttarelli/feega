import { OpKind, type Proposal } from '@feega/plugin-api/protocol';
import { DepsOutcome } from './deps';

export const INSTALL_LABEL = 'Install now';

export type Failure = { failure: string; line: string };

export type InstallOffer = {
  confirm: (message: string, label: string) => Promise<boolean>;
  install: () => Promise<DepsOutcome | Failure>;
  say: (text: string) => unknown;
  command: string;
};

export const dependenciesOf = (proposal: Proposal): string[] => [...new Set(proposal.ops.flatMap((op) => (op.kind === OpKind.Dependency ? [op.name] : [])))];

const REPORTS: Record<DepsOutcome, string> = {
  [DepsOutcome.Ready]: 'Dependencies are already installed.',
  [DepsOutcome.Installed]: 'Installed. The page reloads when the dev server has picked up the new packages.',
  [DepsOutcome.Cancelled]: 'Install cancelled.',
  [DepsOutcome.Failed]: 'The install failed.'
};

export async function offerInstall(offer: InstallOffer, packages: string[]): Promise<void> {
  if (!packages.length) {
    return;
  }
  const wanted = await offer.confirm(`Added ${packages.join(', ')} to package.json. Run "${offer.command}" now?`, INSTALL_LABEL);
  if (!wanted) {
    await offer.say(`Added ${packages.join(', ')} to package.json. Run "${offer.command}" before the page can use it.`);
    return;
  }
  await offer.say(`Running "${offer.command}"…`);
  const out = await offer.install();
  await offer.say(typeof out === 'string' ? REPORTS[out] : `The install failed: ${out.line}`);
}
