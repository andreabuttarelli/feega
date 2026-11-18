import { agentLines, listAgents } from '../lib/agents.ts';
import { listModels, modelLines, setModel } from '../lib/agent-models.ts';

export async function cmdAgents(options: { refresh?: boolean }) {
  const listing = await listAgents({ refresh: options.refresh === true });
  agentLines(listing).forEach((line) => console.log(line));
}

export async function cmdAgentModels(agent: string, options: { set?: string; clear?: boolean; refresh?: boolean }) {
  if (options.set || options.clear) {
    await setModel(agent, options.set ?? null);
  }

  const listing = await listModels(agent, { refresh: options.refresh === true });
  modelLines(listing).forEach((line) => console.log(line));
}
