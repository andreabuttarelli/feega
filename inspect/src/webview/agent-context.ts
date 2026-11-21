import type { CloudComment } from '../host/cloud-api';
import type { Pick, Source } from '../messages';

export type AgentView = { route: string; width: number; breakpoint?: string; theme?: string; state?: string };

const place = (s: Source) => `${s.file}:${s.line}:${s.col}`;

export const selectorOf = (pick: Pick) => [pick.tag, ...pick.classes.split(/\s+/).filter(Boolean)].join('.');

export function agentContext(pick: Pick, view: AgentView): string {
  const lines: (string | null)[] = [
    'Feega selection',
    `source: ${place(pick.source)}`,
    `selector: ${selectorOf(pick)}`,
    pick.component ? `component: ${place(pick.component)}` : null,
    pick.instances > 1 ? `instance: ${pick.instanceIndex + 1} of ${pick.instances}` : null,
    `page: ${view.route}`,
    `preview: ${view.width}px`,
    view.breakpoint ? `breakpoint: ${view.breakpoint}` : null,
    view.theme ? `theme: ${view.theme}` : null,
    view.state ? `state: ${view.state}` : null
  ];
  return lines.filter((line): line is string => line !== null).join('\n');
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
