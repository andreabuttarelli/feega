export class BrowserBusy extends Error {
  constructor() {
    super('every hosted browser session is in use');
    this.name = 'BrowserBusy';
  }
}

export type SessionSlots = {
  take: () => Promise<() => void>;
  busy: () => number;
};

type Waiter = { grant: () => void; timer: ReturnType<typeof setTimeout> };

export function sessionSlots(config: { limit: number; waitMs: number }): SessionSlots {
  let held = 0;
  const waiting: Waiter[] = [];

  const releaseOnce = () => {
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      held--;
      waiting.shift()?.grant();
    };
  };

  const take = () =>
    new Promise<() => void>((resolve, reject) => {
      if (held < config.limit) {
        held++;
        resolve(releaseOnce());
        return;
      }

      const waiter: Waiter = {
        grant: () => {
          clearTimeout(waiter.timer);
          held++;
          resolve(releaseOnce());
        },
        timer: setTimeout(() => {
          waiting.splice(waiting.indexOf(waiter), 1);
          reject(new BrowserBusy());
        }, config.waitMs)
      };
      waiting.push(waiter);
    });

  return { take, busy: () => held };
}
