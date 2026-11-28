import type { PluginApi } from '@feega/plugin-api/client';
import { HandlePhase, OpKind, type Selection, type Source } from '@feega/plugin-api/protocol';
import { ADD, BASE, COLOUR, DEFAULT_MESH, POINTS_LIST, RANDOMIZE, REMOVE, SOFTNESS, addPoint, cssOf, handlesOf, movePoint, parseMesh, randomize, removePoint, setBase, setColor, setSoftness, treeOf, type Mesh } from './mesh';

export const SECTION = 'mesh';
export const OVERLAY = 'points';
export const START = 'start';

const LABEL = 'Mesh gradient';

const textOf = (at: Source) => `${at.file}:${at.line}:${at.col}`;

const sourceOf = (selection: Selection) => textOf(selection.source);

export function meshPlugin(api: PluginApi, rng: () => number = Math.random) {
  const section = api.section(SECTION);
  const overlay = api.overlay(OVERLAY);
  let selection: Selection | null = null;
  let mesh: Mesh | null = null;
  let chosen = '';

  async function show() {
    await section.render(mesh ? treeOf(mesh, chosen) : []);
    await overlay.render(mesh ? handlesOf(mesh, chosen) : []);
  }

  const preview = (next: Mesh) => selection && api.preview(sourceOf(selection), cssOf(next));

  async function write(next: Mesh) {
    mesh = next;
    if (selection) {
      await api.propose(LABEL, [{ kind: OpKind.Style, at: sourceOf(selection), css: cssOf(next) }]);
    }
    await show();
  }

  async function change(next: Mesh, live: boolean) {
    if (!live) {
      await write(next);
      return;
    }
    mesh = next;
    await preview(next);
    await show();
  }

  async function pick(next: Selection | null) {
    const same = next !== null && selection !== null && sourceOf(next) === sourceOf(selection);
    selection = next;
    mesh = next ? parseMesh(next.styles) : null;
    chosen = same && mesh?.points.some((p) => p.id === chosen) ? chosen : (mesh?.points[0].id ?? '');
    await show();
  }

  const current = () => mesh as Mesh;

  const ACTIONS: Record<string, (value: string | number | boolean, live: boolean) => Promise<void>> = {
    [POINTS_LIST]: (id) => ((chosen = String(id)), show()),
    [COLOUR]: (value, live) => change(setColor(current(), chosen, String(value)), live),
    [SOFTNESS]: (value, live) => change(setSoftness(current(), Number(value)), live),
    [BASE]: (value, live) => change(setBase(current(), String(value)), live),
    [ADD]: () => write(addPoint(current(), rng)),
    [REMOVE]: async () => {
      const left = removePoint(current(), chosen);
      chosen = left.points[0].id;
      await write(left);
    },
    [RANDOMIZE]: () => write(randomize(current(), rng))
  };

  section.on((id, value, live) => (mesh ? ACTIONS[id]?.(value, live) : undefined));

  api.menu.on((item, target) => {
    if (item === START && target) {
      void api.propose(LABEL, [{ kind: OpKind.Style, at: textOf(target), css: cssOf(DEFAULT_MESH) }]);
    }
  });

  overlay.on(async (id, phase, x, y) => {
    if (!mesh) {
      return;
    }
    chosen = id;
    const moved = movePoint(mesh, id, x, y);
    const handlers: Record<HandlePhase, () => Promise<void>> = {
      [HandlePhase.Press]: () => show(),
      [HandlePhase.Move]: () => change(moved, true),
      [HandlePhase.Release]: () => write(moved)
    };
    await handlers[phase]();
  });

  api.selection.watch(pick);
}
