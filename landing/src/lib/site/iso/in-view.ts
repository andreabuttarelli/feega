const PAUSED = 'data-paused';

export function inView(node: Element) {
  const observer = new IntersectionObserver(([entry]) => node.toggleAttribute(PAUSED, !entry.isIntersecting));
  observer.observe(node);

  return { destroy: () => observer.disconnect() };
}
