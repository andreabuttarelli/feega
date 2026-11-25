import type { PluginApi } from '@feega/plugin-api/client';
import { OpKind, Place, frameworkOf, type Op, type Selection, type Source } from '@feega/plugin-api/protocol';
import { defaultAttributes, gradientAt, treeOf, writeOf, type Gradient } from './props';
import { dependenciesFor, planFor, stackOf } from './stack';
import { COMPONENT_NAME, componentFile, componentSource } from './component';

export const SECTION = 'props';

const LABEL = 'ShaderGradient';
const INSERT = 'insert';
const NOT_A_COMPONENT = 'Add a ShaderGradient to a React, Next.js or Astro file.';

const sourceOf = (at: Source) => `${at.file}:${at.line}:${at.col}`;

export function shaderGradientPlugin(api: PluginApi) {
  const section = api.section(SECTION);
  let selection: Selection | null = null;
  let gradient: Gradient | null = null;

  async function show() {
    await section.render(gradient ? treeOf(gradient) : []);
  }

  async function pick(next: Selection | null) {
    selection = next;
    const text = next ? await api.source.text() : null;
    gradient = next && text ? gradientAt(text, next.source) : null;
    await show();
  }

  async function change(id: string, value: string | number | boolean, live: boolean) {
    const write = writeOf(id, value);
    if (live || !selection || !gradient || !write) {
      return;
    }
    const written = { ...write.set, ...Object.fromEntries(Object.entries(write.numbers).map(([name, number]) => [name, String(number)])) };
    gradient = { ...gradient, values: { ...gradient.values, ...written } };
    await show();
    await api.propose(LABEL, [{ kind: OpKind.Attributes, at: sourceOf(selection.source), tag: gradient.tag, ...write }]);
  }

  async function insert(target: Source, place: Place | null) {
    const framework = frameworkOf(target.file);
    if (!framework) {
      await api.notify(NOT_A_COMPONENT);
      return;
    }
    const info = await api.project.info();
    const plan = planFor(stackOf(framework, info.packages));
    const dependencies = dependenciesFor(info.packages);
    if (!plan.ok) {
      await api.notify(plan.reason);
      return;
    }
    if (!dependencies.ok) {
      await api.notify(dependencies.reason);
      return;
    }
    const missing: Op[] = dependencies.missing.map((one) => ({ kind: OpKind.Dependency, ...one }));
    const attributes = [defaultAttributes(), plan.attributes].filter(Boolean).join(' ');
    await api.propose(LABEL, [...missing, { kind: OpKind.Insert, at: sourceOf(target), place: place ?? Place.Auto, component: { name: COMPONENT_NAME, file: componentFile(info.typescript), source: componentSource(info.typescript, plan.clientDirective), attributes } }]);
  }

  api.menu.on((item, target, place) => {
    if (item === INSERT && target) {
      void insert(target, place);
    }
  });

  section.on((id, value, live) => void change(id, value, live));

  api.selection.watch(pick);
}
