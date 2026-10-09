export function neutralised(path: HTMLElement[]): () => void {
  const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  const neutral: [string, string][] = Object.entries({ filter: 'none', opacity: '1', mixBlendMode: 'normal', backgroundColor: 'transparent', mask: 'none', WebkitMask: 'none' }).map(([name, value]) => [kebab(name), value]);
  const saved = path.map((el) => neutral.map(([name]) => [el.style.getPropertyValue(name), el.style.getPropertyPriority(name)] as const));
  path.forEach((el) => neutral.forEach(([name, value]) => el.style.setProperty(name, value, 'important')));
  return () => path.forEach((el, i) => neutral.forEach(([name], j) => el.style.setProperty(name, saved[i][j][0], saved[i][j][1])));
}

export function pathStyles(path: HTMLElement[]): string {
  return path.map((el) => el.getAttribute('style') ?? '').join('|');
}
