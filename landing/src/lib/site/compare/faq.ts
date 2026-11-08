import { Feature } from './features';
import { FEEGA_FEATURES, FEEGA_PRICING } from './feega';
import type { Competitor } from './tool';

export type FaqItem = { readonly q: string; readonly a: string };

export function competitorFaq(c: Competitor): readonly FaqItem[] {
  const agent = c.features[Feature.AgentEditing];
  const feegaAgent = FEEGA_FEATURES[Feature.AgentEditing];

  return [
    { q: `Should I pick ${c.name} or Feega?`, a: `${c.pickThem} ${c.pickFeega}` },
    {
      q: `Can an AI agent such as Claude Code work with ${c.name}?`,
      a: `${c.name}: ${agent.has ? 'Yes' : 'No'}${agent.note ? `, ${agent.note.toLowerCase()}` : ''}. Feega: ${feegaAgent.has ? 'Yes' : 'No'}, ${(feegaAgent.note ?? '').toLowerCase()}.`
    },
    { q: `How much does ${c.name} cost compared with Feega?`, a: `${c.name}: ${c.pricing} Feega: ${FEEGA_PRICING}` },
    { q: `Where is ${c.name} better than Feega?`, a: c.theyWin.join(' ') },
    ...(c.faq ?? [])
  ];
}
