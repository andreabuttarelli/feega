export function liveGenerations() {
  const asked = new Map<string, number>();
  const landed = new Map<string, number>();

  return {
    ask(id: string): number {
      const next = (asked.get(id) ?? 0) + 1;
      asked.set(id, next);
      return next;
    },
    newer: (id: string, generation: number) => generation > (landed.get(id) ?? 0),
    land(id: string, generation: number): boolean {
      if (generation <= (landed.get(id) ?? 0)) {
        return false;
      }
      landed.set(id, generation);
      return true;
    }
  };
}
