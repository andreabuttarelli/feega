type Head<D> = { version: number; doc: D };

export function reopened<D, S extends { head: Head<D> }>(cached: S | null, head: Head<D> | null, serverRevision: number): S | null {
  const latest = head ?? cached?.head ?? null;
  if (!cached || !latest || latest.version < serverRevision) {
    return null;
  }
  return { ...cached, head: latest };
}
