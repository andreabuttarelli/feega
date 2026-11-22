import { EditorShotId } from '../../editor-shots';
import { DiffSign, VisualKind, diff, type Visual } from '../alternative';

const editor = (shot: EditorShotId): Visual => ({ kind: VisualKind.Editor, shot });

export const EDITOR_VISUAL = editor(EditorShotId.Overview);
export const PROPERTIES_VISUAL = editor(EditorShotId.Selected);
export const CHANGES_VISUAL = editor(EditorShotId.Changes);
export const LAYERS_MENU_VISUAL = editor(EditorShotId.LayersMenu);
export const RESPONSIVE_VISUAL = editor(EditorShotId.Responsive);

export const BUTTON_DIFF: Visual = {
  kind: VisualKind.Diff,
  file: 'src/lib/Hero.svelte',
  lines: diff(
    [DiffSign.Keep, '.cta {'],
    [DiffSign.Remove, '  padding: 12px 20px;'],
    [DiffSign.Add, '  padding: 14px 24px;'],
    [DiffSign.Keep, '  border-radius: 6px;'],
    [DiffSign.Keep, '}']
  )
};

export const TAILWIND_DIFF: Visual = {
  kind: VisualKind.Diff,
  file: 'app/components/Pricing.tsx',
  lines: diff(
    [DiffSign.Keep, '<h2'],
    [DiffSign.Remove, '  className="text-2xl font-medium"'],
    [DiffSign.Add, '  className="text-3xl font-semibold"'],
    [DiffSign.Keep, '>Pricing</h2>']
  )
};

export const OWN_STEPS = [
  { title: 'Install', text: 'Add the Feega extension in VS Code, Cursor, Windsurf or VSCodium, or run npx feega in the project folder.' },
  { title: 'Open the project', text: 'Feega starts your dev server and shows the running page next to your layers.' },
  { title: 'Click and change', text: 'Pick an element, then set its padding, colour, type or layout in the Properties bar.' },
  { title: 'Read the diff', text: 'Every edit appears in Changes as a diff against your source. Keep it, or undo it.' },
  { title: 'Commit as usual', text: 'Feega writes files and stops there. Review and commit with the tools you already use.' }
] as const;
