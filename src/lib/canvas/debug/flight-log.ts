export type Shelf = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type Props = Record<string, unknown>;

export type FlightLine = { s: number; t: number; k: string; p?: Props };

export enum Send {
  Fetch = 'fetch',
  Beacon = 'beacon'
}

export type Previous = { session: string; seq: number; clean: boolean };

export const FLIGHT_MAX_PENDING = 600;
export const LINES_PER_REQUEST = 60;

const FLAG_KEY = 'feega:flight';
const MARK_KEY = 'feega:flight-mark';
const PARAM = 'debug';
const ON = '1';
const OFF = '0';
const DECIMALS = 1000;

function quietly<T>(run: () => T, fallback: T): T {
  try {
    return run();
  } catch {
    return fallback;
  }
}

export function flightWanted(search: string, shelf: Shelf): boolean {
  const asked = new URLSearchParams(search).get(PARAM);
  if (asked === OFF) {
    quietly(() => shelf.removeItem(FLAG_KEY), undefined);
    return false;
  }
  if (asked !== null) {
    quietly(() => shelf.setItem(FLAG_KEY, ON), undefined);
    return true;
  }
  return quietly(() => shelf.getItem(FLAG_KEY), null) === ON;
}

export function openMark(shelf: Shelf, session: string): Previous | null {
  const raw = quietly(() => shelf.getItem(MARK_KEY), null);
  closeMark(shelf, session, -1, false);
  return raw ? quietly(() => JSON.parse(raw) as Previous, null) : null;
}

export function closeMark(shelf: Shelf, session: string, seq: number, clean: boolean): void {
  const mark: Previous = { session, seq, clean };
  quietly(() => shelf.setItem(MARK_KEY, JSON.stringify(mark)), undefined);
}

export const finite = (n: number): number | string => (Number.isFinite(n) ? Math.round(n * DECIMALS) / DECIMALS : String(n));

export function changed(before: Props | null, now: Props): boolean {
  if (!before) {
    return true;
  }
  for (const key in now) {
    if (before[key] !== now[key]) {
      return true;
    }
  }
  return false;
}

export type FlightDeps = { clock: () => number; send: (lines: FlightLine[], how: Send) => void };

export function createFlightLog({ clock, send }: FlightDeps) {
  let seq = 0;
  let pending: FlightLine[] = [];

  return {
    note(kind: string, props?: Props) {
      const line: FlightLine = { s: seq++, t: Math.round(clock()), k: kind };
      if (props) {
        line.p = props;
      }
      pending.push(line);
      if (pending.length > FLIGHT_MAX_PENDING) {
        pending.splice(0, pending.length - FLIGHT_MAX_PENDING);
      }
    },
    flush(how: Send) {
      if (!pending.length) {
        return;
      }
      const out = pending;
      pending = [];
      for (let i = 0; i < out.length; i += LINES_PER_REQUEST) {
        send(out.slice(i, i + LINES_PER_REQUEST), how);
      }
    },
    last: () => seq - 1
  };
}

export type FlightLog = ReturnType<typeof createFlightLog>;

export function keepaliveBudget(bytes: number) {
  let inFlight = 0;
  return {
    take(size: number): boolean {
      if (inFlight + size > bytes) {
        return false;
      }
      inFlight += size;
      return true;
    },
    give(size: number): void {
      inFlight -= size;
    }
  };
}
