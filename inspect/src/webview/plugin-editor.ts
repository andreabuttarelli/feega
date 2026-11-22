import type { EditorPort } from '@feega/plugin-api/host';
import type { Css, Outcome, Picked, ProjectInfo, Selection, Source } from '@feega/plugin-api/protocol';
import { PluginCall, ToHost, type HostMessage, type Pick, type PluginAsk, type PluginResult } from '../messages';

const SOURCE = /^(.+):(\d+):(\d+)$/;

export const sourceOfText = (text: string): Source => {
  const [, file, line, col] = text.match(SOURCE) ?? [];
  return { file, line: Number(line), col: Number(col) };
};

export const selectionOf = (pick: Pick): Selection => ({
  source: pick.source,
  component: pick.component,
  tag: pick.tag,
  name: pick.name,
  classes: pick.classes,
  rect: pick.rect,
  styles: pick.styles,
  attributes: pick.attributes ?? []
});

export function hostCalls(send: (message: HostMessage) => void) {
  let next = 0;
  const waiting = new Map<number, (result: PluginResult) => void>();
  return {
    ask(ask: PluginAsk): Promise<unknown> {
      const id = ++next;
      return new Promise((resolve, reject) => {
        waiting.set(id, (result) => (result.ok ? resolve(result.value) : reject(new Error(result.reason))));
        send({ kind: ToHost.Plugin, id, ask });
      });
    },
    answer(id: number, result: PluginResult) {
      waiting.get(id)?.(result);
      waiting.delete(id);
    }
  };
}

export type HostCalls = ReturnType<typeof hostCalls>;

type PortDeps = {
  pick: () => Pick | null;
  calls: HostCalls;
  preview: (source: Source, css: Record<string, string> | null) => void;
  notify: (text: string) => void;
  pickFile: (accept: string[]) => Promise<Picked | null>;
};

const camel = (css: Css) => Object.fromEntries(Object.entries(css).map(([name, value]) => [name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), value]));

export function editorPort(deps: PortDeps): EditorPort {
  return {
    selection: () => {
      const pick = deps.pick();
      return pick ? selectionOf(pick) : null;
    },
    project: () => deps.calls.ask({ call: PluginCall.Project }) as Promise<ProjectInfo>,
    sourceText: () => deps.calls.ask({ call: PluginCall.Source, at: deps.pick() ? `${deps.pick()!.source.file}:1:1` : '' }) as Promise<string | null>,
    propose: (proposal) =>
      (deps.calls.ask({ call: PluginCall.Propose, proposal }) as Promise<Outcome>).catch((error: Error): Outcome => ({ ok: false, reason: error.message })),
    preview: (at, css) => deps.preview(sourceOfText(at), css && camel(css)),
    fetch: (url) => deps.calls.ask({ call: PluginCall.Fetch, url }) as Promise<{ status: number; text: string }>,
    pickFile: deps.pickFile,
    notify: deps.notify
  };
}
