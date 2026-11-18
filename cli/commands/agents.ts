import { agentLines, listAgents } from '../lib/agents.ts';

export async function cmdAgents(options: { refresh?: boolean }) {
  const listing = await listAgents({ refresh: options.refresh === true });
  agentLines(listing).forEach((line) => console.log(line));
}
