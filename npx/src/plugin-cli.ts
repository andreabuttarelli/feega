import { createInterface } from 'node:readline/promises';
import { httpFetcher, type Fetcher } from '../../packages/plugin-store/src/fetcher';
import { installPlugin, removePlugin } from '../../packages/plugin-store/src/install';
import { enabledIn, readRegistry } from '../../packages/plugin-store/src/registry';
import { questionOf } from '../../packages/plugin-store/src/review';
import { PluginAction } from './plugin-args';

const OK = 0;
const FAILED = 1;

export type PluginIo = { root: string; say: (line: string) => void; ask: (question: string) => Promise<boolean>; fetch: Fetcher };

export const terminalIo = (root: string, say: (line: string) => void): PluginIo => ({
  root,
  say,
  fetch: httpFetcher(),
  ask: async (question) => {
    if (!process.stdin.isTTY) {
      say(`${question}\nfeega: run this in a terminal to approve it`);
      return false;
    }
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await prompt.question(`${question}\nInstall? (y/N) `)).trim().toLowerCase();
    prompt.close();
    return answer === 'y' || answer === 'yes';
  }
});

const HANDLERS: Record<Exclude<PluginAction, PluginAction.Dev>, (io: PluginIo, value: string) => Promise<number>> = {
  [PluginAction.Add]: async (io, source) => {
    const out = await installPlugin({ root: io.root, fetch: io.fetch, approve: (review) => io.ask(questionOf(review)) }, source);
    io.say(out.ok ? `feega: installed ${out.id} ${out.version}` : `feega: ${out.reason}`);
    return out.ok ? OK : FAILED;
  },
  [PluginAction.Remove]: async (io, id) => {
    const out = await removePlugin(io.root, id);
    io.say(out.ok ? `feega: removed ${id}` : `feega: ${out.reason}`);
    return out.ok ? OK : FAILED;
  },
  [PluginAction.List]: async (io) => {
    const registry = readRegistry(io.root);
    const lines = Object.entries(registry.installed).map(([id, held]) => `${id} ${held.version}  ${held.source}  ${enabledIn(registry, id) ? 'on' : 'off'}`);
    lines.length ? lines.forEach(io.say) : io.say('feega: no plugins installed');
    return OK;
  }
};

export const runPlugin = (io: PluginIo, action: Exclude<PluginAction, PluginAction.Dev>, value: string) => HANDLERS[action](io, value);
