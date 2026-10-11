export function offStageClip(node: Node): boolean {
  return node instanceof HTMLElement && node.classList.contains('clip') && getComputedStyle(node).visibility === 'hidden';
}
