import { LibFramework, TARGETS, layoutOf, type InsertItem } from '@feega/live-edit/library-insert';
import { CloudError, CloudFailure, type ProFile } from './cloud-api';
import { INCLUDED_IN_CLOUD } from './library';

export const SIGN_IN_FOR_PRO = 'Sign in to Feega to insert Pro templates';
export const SIGN_IN = 'Sign in';
export const SEE_PRICING = 'See pricing';
export const PRICING_URL = 'https://www.feega.app/pricing';

export enum ProRefusal {
  SignIn = 'sign-in',
  Plan = 'plan'
}

export type ProFetch = (id: string, framework: LibFramework) => Promise<ProFile[]>;

export type ProItem = { ok: true; item: InsertItem } | { ok: false; reason: string; refusal: ProRefusal | null };

type Refusal = { reason: string; refusal: ProRefusal };

const REFUSALS: Partial<Record<CloudFailure, Refusal>> = {
  [CloudFailure.NotSignedIn]: { reason: SIGN_IN_FOR_PRO, refusal: ProRefusal.SignIn },
  [CloudFailure.PlanRequired]: { reason: INCLUDED_IN_CLOUD, refusal: ProRefusal.Plan }
};

export const frameworkOf = (packageJson: string | null): LibFramework | null => {
  const layout = layoutOf(packageJson);

  return layout ? TARGETS[layout].framework : null;
};

function refusedWith(error: unknown): ProItem {
  const known = error instanceof CloudError ? REFUSALS[error.failure] : undefined;

  return { ok: false, reason: known?.reason ?? (error as Error).message, refusal: known?.refusal ?? null };
}

export async function withProFiles(item: InsertItem, framework: LibFramework, fetchFiles: ProFetch): Promise<ProItem> {
  try {
    const files = await fetchFiles(item.id, framework);

    return { ok: true, item: { ...item, files: { ...item.files, [framework]: files.map((file) => ({ name: file.path, text: file.content })) } } };
  } catch (error) {
    return refusedWith(error);
  }
}

const NO_PROJECT = 'no Svelte, React, Vue or Astro project found in package.json';

export function proItemFor(item: InsertItem, packageJson: string | null, fetchFiles: ProFetch | undefined): Promise<ProItem> {
  const framework = frameworkOf(packageJson);
  if (!fetchFiles) {
    return Promise.resolve({ ok: false, reason: INCLUDED_IN_CLOUD, refusal: null });
  }

  return framework ? withProFiles(item, framework, fetchFiles) : Promise.resolve({ ok: false, reason: NO_PROJECT, refusal: null });
}
