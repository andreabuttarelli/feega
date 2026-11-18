import type { AgentModels } from '$lib/acp/agent-models';
import { listAcpModels, type AgentCommand } from './client';
import { Refresh } from './detect';

type Lister = (agent: AgentCommand, cwd: string) => Promise<AgentModels | null>;

export function createModelCache(list: Lister, cwd: string) {
  const answers = new Map<string, Promise<AgentModels | null>>();

  return {
    models(id: string, agent: AgentCommand, refresh: Refresh): Promise<AgentModels | null> {
      const cached = answers.get(id);
      if (cached && refresh === Refresh.Cached) {
        return cached;
      }

      const asked = list(agent, cwd);
      answers.set(id, asked);
      asked.catch(() => answers.delete(id));
      return asked;
    }
  };
}

export const modelCache = createModelCache(listAcpModels, process.cwd());
