import type { Pick, Source } from '../messages';

export type AgentView = { route: string; width: number; breakpoint?: string; theme?: string; state?: string };

const place = (s: Source) => `${s.file}:${s.line}:${s.col}`;

const selectorOf = (pick: Pick) => [pick.tag, ...pick.classes.split(/\s+/).filter(Boolean)].join('.');

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
