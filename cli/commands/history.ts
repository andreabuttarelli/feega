import { loadSession } from '../lib/auth.ts';
import { PointAction, historyApi, historyRows } from '../lib/history.ts';

type HistoryFlags = { ai?: boolean; people?: boolean; frame?: string; json?: boolean; org?: string; preview?: string; restore?: string; name?: string; as?: string };

const AUTHOR_FLAGS = { ai: 'ai', people: 'people' } as const;

const POINT_FLAGS = [PointAction.Preview, PointAction.Restore, PointAction.Name] as const;

async function token(): Promise<string> {
  const session = await loadSession();
  if (!session) {
    console.error('Session expired or missing. Run: feega login');
    process.exit(1);
  }
  return session.access_token;
}

export async function cmdHistory(canvasId: string, opts: HistoryFlags) {
  const action = POINT_FLAGS.find((flag) => opts[flag]);
  if (action) {
    const answer = await historyApi.at(await token(), { canvasId, entryId: opts[action]!, action, name: opts.as }, opts.org);
    console.log(JSON.stringify(answer, null, 2));
    return;
  }

  const author = (Object.keys(AUTHOR_FLAGS) as (keyof typeof AUTHOR_FLAGS)[]).find((flag) => opts[flag]);
  const history = await historyApi.list(await token(), { canvasId, author: author && AUTHOR_FLAGS[author], frame: opts.frame }, opts.org);

  if (opts.json) {
    console.log(JSON.stringify(history, null, 2));
    return;
  }
  console.table(historyRows(history));
}
