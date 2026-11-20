export function typedCommit(commit: (raw: string) => void) {
  let last: string | null = null;

  return {
    focus: () => {
      last = null;
    },
    commit: (raw: string) => {
      if (raw === last) {
        return;
      }
      last = raw;
      commit(raw);
    }
  };
}
