export const postersFor = <P extends { frame: { id: string } }>(posters: readonly P[], whole: ReadonlySet<string>): P[] => posters.filter((p) => !whole.has(p.frame.id));
