import { loadSession } from '../lib/auth.ts';
import { LiveProp, LiveSide, liveChangesApi, liveEditApi, livePushApi, liveUndoApi, type LiveEdited } from '../lib/live-edit.ts';

export type LiveEditOptions = { side?: string; token?: string; was?: string };

async function token(): Promise<string> {
  const session = await loadSession();
  if (!session) {
    throw new Error('Session expired or missing. Run: feega login');
  }
  return session.access_token;
}

function printEdited(out: LiveEdited) {
  console.log(`${out.sha.slice(0, 8)} · ${out.files.join(', ')}${out.token ? ` · ${out.token}` : ''}`);
  console.log(out.patch);
}

export async function cmdLiveEdit(at: string, prop: string, value: string | undefined, options: LiveEditOptions) {
  if (!Object.values(LiveProp).includes(prop as LiveProp)) {
    throw new Error(`Unknown prop ${prop}: use ${Object.values(LiveProp).join(', ')}`);
  }
  if (options.side && !Object.values(LiveSide).includes(options.side as LiveSide)) {
    throw new Error(`Unknown side ${options.side}: use ${Object.values(LiveSide).join(', ')}`);
  }
  if (value === undefined && !options.token) {
    throw new Error('Give a value, or --token for an exact Tailwind token');
  }

  printEdited(await liveEditApi(await token(), { at, prop: prop as LiveProp, value, token: options.token, side: options.side as LiveSide | undefined, was: options.was }));
}

export async function cmdLiveUndo(sha: string) {
  printEdited(await liveUndoApi(await token(), sha));
}

export async function cmdLiveChanges() {
  const changes = await liveChangesApi(await token());
  console.log(`${changes.files.length} file(s) on ${changes.branch}`);
  if (changes.patch) {
    console.log(changes.patch);
  }
}

export async function cmdLivePush() {
  const pushed = await livePushApi(await token());
  console.log(`Pushed on ${pushed.branch}${pushed.pull ? ` · ${pushed.pull.url}` : ''}`);
}
