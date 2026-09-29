export function needsUncensoredConfirm(input: {
  nextUncensored: boolean;
  hasIncomingEdges: boolean;
  hasReferences: boolean;
}): boolean {
  return input.nextUncensored && (input.hasIncomingEdges || input.hasReferences);
}
