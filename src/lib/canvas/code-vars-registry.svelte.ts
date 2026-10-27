import type { VarDecl } from './code-vars';

const bySource = $state<Record<string, Record<string, VarDecl>>>({});

export function rememberVars(sourceId: string, decls: readonly VarDecl[]) {
  bySource[sourceId] = { ...bySource[sourceId], ...Object.fromEntries(decls.map((d) => [d.name, d])) };
}

export function forgetVars(sourceId: string) {
  delete bySource[sourceId];
}

export function varsOf(sourceId: string): VarDecl[] {
  return Object.values(bySource[sourceId] ?? {});
}
