type Port = Record<string, (...args: never[]) => Promise<unknown>>;

export type Phases = {
  time<T>(name: string, work: Promise<T>): Promise<T>;
  port<P extends Port>(port: P): P;
  header(): string;
};

export function serverTiming(now: () => number = () => performance.now()): Phases {
  const spans: string[] = [];

  const time = async <T>(name: string, work: Promise<T>): Promise<T> => {
    const started = now();
    try {
      return await work;
    } finally {
      spans.push(`${name};dur=${Math.round(now() - started)}`);
    }
  };

  return {
    time,
    port: <P extends Port>(port: P) =>
      Object.fromEntries(Object.entries(port).map(([name, call]) => [name, (...args: never[]) => time(name, call(...args))])) as P,
    header: () => spans.join(', ')
  };
}
