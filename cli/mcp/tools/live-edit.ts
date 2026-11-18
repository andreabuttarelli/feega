import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { LiveProp, LiveSide, liveChangesApi, liveEditApi, livePushApi, liveUndoApi } from '../../lib/live-edit.ts';
import { withAuth } from '../util.ts';

enum LiveAction {
  Edit = 'edit',
  Undo = 'undo',
  Changes = 'changes',
  Push = 'push'
}

const MISSING_EDIT = 'edit needs at, prop and value (or token)';
const MISSING_SHA = 'undo needs the sha an edit returned';

export function registerLiveEditTools(server: McpServer) {
  server.registerTool(
    'live_edit',
    {
      title: 'Edit an element of the running app and write the change to its source file',
      description:
        'Local Feega only. `edit` (default) changes one property of the element at `at` (the `file:line:col` in its `data-feega-src`, set by `feega init`): text, color, fill, fontSize, fontWeight, padding, margin, gap or radius. ' +
        'Only the one Tailwind class or text is rewritten, with a repo token when the value matches one; commits on the branch `feega/live`, which the live frames run from, never on the user branch. ' +
        '`side` (x, y, t, r, b, l) narrows padding, margin and gap. `undo` reverts the commit `sha`. `changes` lists files and the diff. `push` sends them to a `feega/` branch. Free.',
      inputSchema: z.object({
        action: z.enum(LiveAction).optional(),
        at: z.string().optional(),
        prop: z.enum(LiveProp).optional(),
        value: z.string().optional(),
        token: z.string().optional(),
        side: z.enum(LiveSide).optional(),
        was: z.string().optional(),
        sha: z.string().optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ action, at, prop, value, token, side, was, sha }) =>
      withAuth((auth) => {
        if (action === LiveAction.Changes) {
          return liveChangesApi(auth);
        }
        if (action === LiveAction.Push) {
          return livePushApi(auth);
        }
        if (action === LiveAction.Undo) {
          if (!sha) {
            throw new Error(MISSING_SHA);
          }
          return liveUndoApi(auth, sha);
        }
        if (!at || !prop || (value === undefined && !token)) {
          throw new Error(MISSING_EDIT);
        }
        return liveEditApi(auth, { at, prop, value, token, side, was });
      })
  );
}
