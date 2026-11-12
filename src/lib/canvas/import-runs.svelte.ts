const keyOf = (nodeId: string, key: string) => `${nodeId} ${key}`;

class ImportRuns {
  running = $state<Record<string, string>>({});
  notes = $state<Record<string, string>>({});

  start(nodeId: string, key: string, label: string): boolean {
    const at = keyOf(nodeId, key);
    if (this.running[at]) {
      return false;
    }
    this.running = { ...this.running, [at]: label };
    this.notes = { ...this.notes, [at]: '' };
    return true;
  }

  finish(nodeId: string, key: string, note: string) {
    const at = keyOf(nodeId, key);
    this.running = Object.fromEntries(Object.entries(this.running).filter(([k]) => k !== at));
    this.notes = { ...this.notes, [at]: note };
  }

  note(nodeId: string, key: string, note: string) {
    this.notes = { ...this.notes, [keyOf(nodeId, key)]: note };
  }

  runningFor(nodeId: string, path: string): string | undefined {
    return Object.entries(this.running).find(([k]) => k === keyOf(nodeId, path) || k.startsWith(`${keyOf(nodeId, path)}@`))?.[1];
  }

  noteFor(nodeId: string, path: string): string | undefined {
    return Object.entries(this.notes).find(([k, v]) => v && (k === keyOf(nodeId, path) || k.startsWith(`${keyOf(nodeId, path)}@`)))?.[1];
  }
}

export const importRuns = new ImportRuns();
