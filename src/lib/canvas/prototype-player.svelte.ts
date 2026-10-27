export class PrototypePlayerSession {
  editing = $state<string | null>(null);
  start = $state<string | null>(null);

  play() {
    this.start = this.editing;
  }

  stop() {
    this.start = null;
  }
}

export const prototypePlayer = new PrototypePlayerSession();
