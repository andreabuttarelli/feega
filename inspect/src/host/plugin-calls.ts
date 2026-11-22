import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { liveAtOf, reader } from '@feega/live-edit/live-ask';
import type { Outcome, Proposal } from '@feega/plugin-api/protocol';
import { PluginCall, type PluginAsk, type PluginResult } from '../messages';
import type { Written } from './file-edits';

const TSCONFIG = 'tsconfig.json';
const PUBLIC_DIR = 'public';
const STATIC_DIR = 'static';
const FETCH_LIMIT_CHARS = 1_000_000;

export type PluginCallDeps = {
  root: string;
  appDir: () => string;
  propose: (proposal: Proposal, appDir: string) => Promise<Written>;
  fetch: typeof fetch;
};

const exists = (path: string) => access(path).then(() => true, () => false);

const outcomeOf = (written: Written): Outcome => (written.ok ? { ok: true } : { ok: false, reason: written.reason });

export function pluginCalls(deps: PluginCallDeps) {
  const handlers: { [K in PluginCall]: (ask: Extract<PluginAsk, { call: K }>) => Promise<unknown> } = {
    [PluginCall.Project]: async () => {
      const app = join(deps.root, deps.appDir());
      const [typescript, hasPublic, hasStatic] = await Promise.all([exists(join(app, TSCONFIG)), exists(join(app, PUBLIC_DIR)), exists(join(app, STATIC_DIR))]);
      return { typescript, publicDir: hasStatic && !hasPublic ? STATIC_DIR : PUBLIC_DIR };
    },
    [PluginCall.Source]: async (ask) => {
      const at = liveAtOf(ask.at);
      return at ? reader(deps.root)(at.file) : null;
    },
    [PluginCall.Propose]: async (ask) => outcomeOf(await deps.propose(ask.proposal, deps.appDir())),
    [PluginCall.Fetch]: async (ask) => {
      const response = await deps.fetch(ask.url);
      return { status: response.status, text: (await response.text()).slice(0, FETCH_LIMIT_CHARS) };
    }
  };

  return async (ask: PluginAsk): Promise<PluginResult> => {
    try {
      return { ok: true, value: await (handlers[ask.call] as (ask: PluginAsk) => Promise<unknown>)(ask) };
    } catch (error) {
      return { ok: false, reason: (error as Error).message };
    }
  };
}
