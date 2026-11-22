import type { CloudComment } from '../host/cloud-api';
import type { Pick, Source } from '../messages';

export type AgentView = { route: string; width: number; breakpoint?: string; theme?: string; state?: string };

const place = (s: Source) => `${s.file}:${s.line}:${s.col}`;

export const selectorOf = (pick: Pick) => [pick.tag, ...pick.classes.split(/\s+/).filter(Boolean)].join('.');

const present = (lines: (string | null)[]): string[] => lines.filter((line): line is string => line !== null);

const elementLines = (pick: Pick): string[] =>
  present([`source: ${place(pick.source)}`, `selector: ${selectorOf(pick)}`, pick.component ? `component: ${place(pick.component)}` : null, pick.instances > 1 ? `instance: ${pick.instanceIndex + 1} of ${pick.instances}` : null]);

const viewLines = (view: AgentView): string[] =>
  present([`page: ${view.route}`, `preview: ${view.width}px`, view.breakpoint ? `breakpoint: ${view.breakpoint}` : null, view.theme ? `theme: ${view.theme}` : null, view.state ? `state: ${view.state}` : null]);

export const agentContext = (pick: Pick, view: AgentView): string => ['Feega selection', ...elementLines(pick), ...viewLines(view)].join('\n');

const numbered = (pick: Pick, i: number): string => elementLines(pick).map((line, at) => (at === 0 ? `${i + 1}. ${line}` : `   ${line}`)).join('\n');

export function agentContexts(picks: Pick[], view: AgentView): string {
  if (picks.length === 1) {
    return agentContext(picks[0], view);
  }
  return [[`Feega selection: ${picks.length} elements`, ...viewLines(view)].join('\n'), ...picks.map(numbered)].join('\n\n');
}

export function commentContext(comment: CloudComment, replies: CloudComment[] = []): string {
  const lines = [
    'Feega comment',
    `author: ${comment.authorName}`,
    `comment: ${comment.body}`,
    ...replies.map((reply) => `reply from ${reply.authorName}: ${reply.body}`),
    `source: ${place({ file: comment.sourceFile, line: comment.sourceLine, col: comment.sourceCol })}`,
    `selector: ${comment.selector}`
  ];
  return lines.join('\n');
}
