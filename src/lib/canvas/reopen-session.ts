type Head<D> = { version: number; doc: D };

export function reopened<D, S extends { head: Head<D> }>(cached: S | null, head: Head<D> | null, serverRevision: number): S | null {
  if (!cached || !head || head.version < serverRevision) {
    return null;
  }
  return { ...cached, head };
}
