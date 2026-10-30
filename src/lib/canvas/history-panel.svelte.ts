let asked = $state(0);
let frameId = $state<string | null>(null);

export const historyPanel = {
  get asked(): number {
    return asked;
  },
  get frameId(): string | null {
    return frameId;
  },
  show(frame: string | null = null) {
    frameId = frame;
    asked += 1;
  }
};
