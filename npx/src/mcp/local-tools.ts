import { z } from 'zod';
import { editorFor, missingText, type EditorEntry, type EditorRegistry, type Want } from '../../../inspect/src/host/local-bridge/editors';
import type { Tool } from './tools';

export type LocalDeps = { registry: EditorRegistry; send: typeof fetch; cwd: string };

const NOTHING_SELECTED = 'Nothing is selected in Feega. Click an element in the editor.';
const PROJECT = z.string().optional().describe('Project folder of the Feega editor to ask; defaults to the editor of the current folder');

type Ask = { project?: string };

export function localTools({ registry, send, cwd }: LocalDeps): Record<string, Tool> {
  async function answer(path: string, want: Want): Promise<Record<string, unknown>> {
    const editor = editorFor(registry.list(), want);
    if (!editor) {
      throw new Error(missingText(registry.list()));
    }
    try {
      const reply = await send(`http://127.0.0.1:${editor.port}${path}`, { headers: { authorization: `Bearer ${editor.token}` } });
      return (await reply.json()) as Record<string, unknown>;
    } catch {
      registry.drop(editor);
      return answer(path, want);
    }
  }

  const wantOf = ({ project }: Ask): Want => ({ cwd, project });

  return {
    feega_selection: {
      description: 'The element the user selected in the running Feega editor: source file, line, selector, component and view, to edit exactly that element instead of guessing from a description. Same text as Copy for agent. Needs Feega open in this project (npx feega or the VS Code panel); no sign-in.',
      input: { project: PROJECT },
      run: async (input: Ask) => {
        const { context } = await answer('/selection', wantOf(input));
        return context ? { context } : { context: null, note: NOTHING_SELECTED };
      }
    },
    feega_changes: {
      description: 'The visual edits made in the running Feega editor this session: property, value, scope and the source files each one touched. Needs Feega open in this project; no sign-in.',
      input: { project: PROJECT },
      run: async (input: Ask) => ({ changes: (await answer('/changes', wantOf(input))).changes })
    },
    feega_editors: {
      description: 'The Feega editors running on this machine, with the project of each and when it was last used.',
      input: {},
      run: async () => ({ editors: registry.list().map(({ projectRoot, lastActiveAt }: EditorEntry) => ({ project: projectRoot, lastActiveAt })) })
    }
  };
}
