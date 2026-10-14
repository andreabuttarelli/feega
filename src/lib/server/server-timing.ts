export type Phases = {
  time<T>(name: string, work: Promise<T>): Promise<T>;
  header(): string;
};

export function serverTiming(now: () => number = () => performance.now()): Phases {
  const spans: string[] = [];

  return {
    async time(name, work) {
      const started = now();
      try {
        return await work;
      } finally {
        spans.push(`${name};dur=${Math.round(now() - started)}`);
      }
    },
    header: () => spans.join(', ')
  };
}
