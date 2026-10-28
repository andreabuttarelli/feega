export enum CodeTarget {
  React = 'react',
  Html = 'html',
  Svelte = 'svelte'
}

export const CODE_TARGETS = Object.values(CodeTarget) as [CodeTarget, ...CodeTarget[]];

export type CodeFile = { path: string; content: string };

export type CodeExport = { target: CodeTarget; files: CodeFile[]; notes: string[] };
