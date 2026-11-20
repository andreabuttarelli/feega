export function browseHistory() {
  let routes: string[] = [];
  let at = -1;

  const move = (step: number): string | null => {
    const next = at + step;
    if (next < 0 || next >= routes.length) {
      return null;
    }
    at = next;
    return routes[at];
  };

  return {
    visited(route: string) {
      if (routes[at] === route) {
        return;
      }
      routes = [...routes.slice(0, at + 1), route];
      at = routes.length - 1;
    },
    back: () => move(-1),
    forward: () => move(1),
    canBack: () => at > 0,
    canForward: () => at < routes.length - 1,
    current: () => routes[at] ?? '/'
  };
}
