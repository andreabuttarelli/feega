import { COMPARISONS, comparisonPath } from '../compare';
import { FEEGA_FEATURES } from '../compare/feega';
import { Feature } from '../compare/features';
import type { Guide } from './guide';
import { docsLink } from './shared';

const yesNo = (v: boolean) => (v ? 'Yes' : 'No');

const KEY = [Feature.AgentEditing, Feature.VideoExport, Feature.OpenSource, Feature.WorksLocally] as const;

const rows = [
  ['Feega', FEEGA_FEATURES] as const,
  ...Object.values(COMPARISONS).map((c) => [c.name, c.features] as const)
]
  .map(([name, f]) => `<tr><th scope="row">${name}</th>${KEY.map((k) => `<td>${yesNo(f[k].has)}</td>`).join('')}</tr>`)
  .join('');

export const BEST_TOOLS: Guide = {
  title: 'Best tools for motion design with AI agents (2026)',
  description: 'Feega, Remotion, Jitter, After Effects, Rive, Figma, Canva and more compared for AI agents: agent editing, video export, open source, local use.',
  heading: 'Best tools for motion design with AI agents (2026)',
  answer:
    'The right tool depends on what the agent should write. Feega lets Claude Code edit a visual video document through MCP. Remotion has the agent write React code. Jitter, After Effects, Rive, Figma and Canva are built for people first. The table shows agent editing, export, licence and local use.',
  steps: [],
  sections: [
    {
      heading: 'At a glance',
      html: `<div class="table"><table><thead><tr><th></th><th>Agent can edit</th><th>Video export</th><th>Open source</th><th>Works locally</th></tr></thead><tbody>${rows}</tbody></table></div><p>Every cell comes from the comparison page of that tool, with sources and the date checked.</p>`
    },
    {
      heading: 'How to choose',
      html: `<ul>${Object.entries(COMPARISONS)
        .map(([slug, c]) => `<li><strong>${c.name}.</strong> ${c.pickThem} <a href="${comparisonPath(slug)}">Compare with Feega</a>.</li>`)
        .join('')}</ul>`
    }
  ],
  faq: [
    { q: 'Which tool is best for motion design with Claude Code?', a: 'Feega if you want the agent to edit a visual document you can finish by hand; Remotion if you want the agent to write React code for templated video.' },
    { q: 'Is any of them free?', a: 'Feega runs locally for free under Apache-2.0. See each comparison page for the pricing of the others.' },
    { q: 'How was this checked?', a: 'Competitor facts come from their public sites, cited on each comparison page with the date checked. Feega facts come from its repository.' }
  ],
  links: [docsLink('/integrations/mcp/', 'Feega MCP docs')],
  checked: '2026-11-08'
};
