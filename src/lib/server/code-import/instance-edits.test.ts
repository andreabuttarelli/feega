import { describe, expect, it } from 'vitest';
import { EditTarget, routedEdits } from './instance-edits';
import type { SourceEdit } from './write-back';

const BUTTON = `export function Button({ label }: { label: string }) {
  return (
    <button className="bg-blue-600" onClick={() => go(label)}>
      {label}
    </button>
  );
}
`;

const STYLED = BUTTON.replace('{ label }: { label: string }', '{ label, style }: { label: string; style?: React.CSSProperties }');

const PAGE = `export default function Page() {
  return (
    <main>
      <Button label="Buy now" />
      <Button label="Buy now" />
    </main>
  );
}
`;

const files = (button: string): Record<string, string> => ({ 'components/Button.tsx': button, 'app/page.tsx': PAGE });

const reader = (all: Record<string, string>) => async (path: string) => all[path] ?? null;

const inButton = { file: 'components/Button.tsx', line: 3, column: 4 };
const firstUse = { file: 'app/page.tsx', line: 4, column: 6 };

const edit = (look: SourceEdit['look'], was: SourceEdit['was']): SourceEdit => ({ at: inButton, look, was, usage: firstUse });

describe('una modifica su un’istanza', () => {
  it('un testo che viene da una prop cambia la prop in quel punto d’uso, non il componente', async () => {
    const done = await routedEdits([edit({ text: 'Buy today' }, { text: 'Buy now' })], reader(files(BUTTON)), EditTarget.Instance);

    expect(done.files.map((f) => f.path)).toEqual(['app/page.tsx']);
    expect(done.files[0].after).toBe(PAGE.replace('<Button label="Buy now" />', '<Button label="Buy today" />'));
    expect(done.proposals).toEqual([]);
  });

  it('uno stile su un componente che accetta style diventa un override in quel punto d’uso', async () => {
    const done = await routedEdits([edit({ color: '#e11d48' }, { color: '#ffffff' })], reader(files(STYLED)), EditTarget.Instance);

    expect(done.files.map((f) => f.path)).toEqual(['app/page.tsx']);
    expect(done.files[0].after).toContain('<Button label="Buy now" style={{ color: "#e11d48" }} />\n      <Button label="Buy now" />');
  });

  it('senza una prop adatta propone di aggiungerla e non tocca niente', async () => {
    const done = await routedEdits([edit({ color: '#e11d48' }, { color: '#ffffff' })], reader(files(BUTTON)), EditTarget.Instance);

    expect(done.files).toEqual([]);
    expect(done.proposals).toEqual([{ component: 'components/Button.tsx', usage: firstUse, props: ['color'] }]);
  });

  it('"applica al componente main" scrive nel file del componente', async () => {
    const done = await routedEdits([edit({ color: '#e11d48' }, { color: '#ffffff' })], reader(files(BUTTON)), EditTarget.Main);

    expect(done.files.map((f) => f.path)).toEqual(['components/Button.tsx']);
  });
});
