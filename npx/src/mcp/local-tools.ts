import { z } from 'zod';
import { editorFor, missingText, type EditorEntry, type EditorRegistry, type Want } from '../../../inspect/src/host/local-bridge/editors';
import { Picture, type Tool } from './tools';

export type LocalDeps = { registry: EditorRegistry; send: typeof fetch; cwd: string };

const CAPTURE_FAILED = 'Feega could not capture the tab. Open the Feega panel and wait for the page to load.';
const NOTHING_SELECTED = 'Nothing is selected in Feega. Click an element in the editor.';
const PROJECT = z.string().optional().describe('Project folder of the Feega editor to ask; defaults to the editor of the current folder');

type Ask = { project?: string };

type ShotAsk = Ask & { selection?: boolean };

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
    feega_screenshot: {
      description: 'A screenshot of the tab the user is looking at in the running Feega editor (the page, or the focused component), as an image. Pass selection to crop it to the selected element. Needs Feega open in this project; no sign-in. Stays on this machine.',
      input: { project: PROJECT, selection: z.boolean().optional().describe('Crop to the selected element instead of the whole tab') },
      run: async (input: ShotAsk) => {
        const { png } = await answer(input.selection ? '/screenshot?selection=1' : '/screenshot', wantOf(input));
        if (typeof png !== 'string') {
          throw new Error(CAPTURE_FAILED);
        }
        return new Picture(png);
      }
    },
    feega_context: {
      description: 'The context block of the Feega composer: the selected elements with source, selector and component, and the view (page, preview width, breakpoint, theme, state, focused component). Unlike feega_selection it answers even when nothing is selected. Needs Feega open in this project; no sign-in.',
      input: { project: PROJECT },
      run: async (input: Ask) => ({ context: (await answer('/context', wantOf(input))).context })
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
