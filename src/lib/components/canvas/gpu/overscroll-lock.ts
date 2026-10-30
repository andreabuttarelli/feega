const NONE = 'none';

export function lockOverscroll(): () => void {
  const targets = [document.documentElement, document.body];
  const before = targets.map((el) => el.style.overscrollBehavior);

  for (const el of targets) {
    el.style.overscrollBehavior = NONE;
  }

  return () => targets.forEach((el, i) => (el.style.overscrollBehavior = before[i]));
}
