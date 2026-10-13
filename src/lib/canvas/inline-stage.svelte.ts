let offered = $state.raw<{ nodeId: string; el: HTMLElement } | null>(null);

export const inlineStage = {
  offer(nodeId: string, el: HTMLElement) {
    const mine = { nodeId, el };
    offered = mine;
    return () => {
      if (offered === mine) {
        offered = null;
      }
    };
  },
  of(nodeId: string): HTMLElement | null {
    return offered?.nodeId === nodeId ? offered.el : null;
  }
};

export function hostedIn(stage: HTMLElement, host: HTMLElement | null) {
  const home = { parent: stage.parentElement, next: stage.nextSibling };

  function place(target: HTMLElement | null) {
    if (target) {
      target.append(stage);
      return;
    }
    home.parent?.insertBefore(stage, home.next);
  }

  place(host);
  return {
    update: place,
    destroy: () => stage.remove()
  };
}
