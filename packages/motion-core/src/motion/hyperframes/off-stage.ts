export function unseen(node: Node): boolean {
  if (!(node instanceof HTMLElement)) {
    return false;
  }
  const style = getComputedStyle(node);
  const outOfFlow = style.position === 'absolute' || style.position === 'fixed';
  return (style.opacity === '0' && outOfFlow) || (node.classList.contains('clip') && style.visibility === 'hidden');
}
