import type { EditorShotId } from '../editor-shots';

export enum Tool {
  Lovable = 'Lovable',
  Framer = 'Framer'
}

export enum Agent {
  ClaudeCode = 'Claude Code',
  Codex = 'Codex',
  Cursor = 'Cursor'
}

export type StripRow = { readonly aspect: string; readonly tool: string; readonly feega: string };

export type Differentiator = { readonly heading: string; readonly text: string };

export type Faq = { readonly q: string; readonly a: string };

export type Variant = {
  readonly slug: string;
  readonly title: string;
  readonly h1: string;
  readonly subhead: string;
  readonly agent: Agent;
  readonly tool: Tool;
  readonly shot: EditorShotId;
  readonly meta: { readonly title: string; readonly description: string };
  readonly differentiators: readonly [Differentiator, Differentiator, Differentiator];
  readonly strip: readonly StripRow[];
  readonly keepTool: string;
  readonly faq: readonly Faq[];
};
