export function unseen(node: Node): boolean {
  if (!(node instanceof HTMLElement)) {
    return false;
  }
  const style = getComputedStyle(node);
  return style.opacity === '0' || (node.classList.contains('clip') && style.visibility === 'hidden');
}
