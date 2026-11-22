export enum Signal {
  Alive = 'alive',
  Lost = 'lost',
  Exited = 'exited'
}

export enum Step {
  None = 'none',
  Restarting = 'restarting',
  Reload = 'reload',
  Respawn = 'respawn',
  GiveUp = 'give-up'
}

const MAX_RESPAWNS = 3;
const RESPAWN_WINDOW_MS = 60_000;

export class RestartWatch {
  private down = false;
  private respawns: number[] = [];

  feed(signal: Signal, at: number): Step {
    if (signal === Signal.Alive) {
      return this.answered();
    }
    if (signal === Signal.Exited) {
      return this.exited(at);
    }
    return this.quiet();
  }

  private answered(): Step {
    if (!this.down) {
      return Step.None;
    }
    this.down = false;
    return Step.Reload;
  }

  private quiet(): Step {
    if (this.down) {
      return Step.None;
    }
    this.down = true;
    return Step.Restarting;
  }

  private exited(at: number): Step {
    this.respawns = this.respawns.filter((t) => at - t < RESPAWN_WINDOW_MS);
    if (this.respawns.length >= MAX_RESPAWNS) {
      return Step.GiveUp;
    }
    this.respawns.push(at);
    this.down = true;
    return Step.Respawn;
  }
}
