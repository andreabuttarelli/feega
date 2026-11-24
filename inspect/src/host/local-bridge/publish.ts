import { editorRegistry, type EditorRegistry } from './editors';
import { startBridge, type BridgeState } from './server';

export type PublishedBridge = { touch: () => void; stop: () => Promise<void> };

export type Publish = { registry: EditorRegistry; projectRoot: string; state: BridgeState; pid?: number; now?: () => number };

export async function publishBridge({ registry, projectRoot, state, pid = process.pid, now = Date.now }: Publish): Promise<PublishedBridge> {
  const bridge = await startBridge(state);
  const entry = () => ({ projectRoot, port: bridge.port, token: bridge.token, pid, lastActiveAt: now() });
  registry.save(entry());

  return {
    touch: () => registry.save(entry()),
    stop: async () => {
      registry.drop(entry());
      await bridge.close();
    }
  };
}

export const publishLocal = (projectRoot: string, state: BridgeState): Promise<PublishedBridge> => publishBridge({ registry: editorRegistry(), projectRoot, state });
