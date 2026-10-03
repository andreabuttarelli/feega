export type ChatScope = { projectId?: string; motionNodeId?: string };

export function chatEndpoint(scope: ChatScope): string {
  if (!scope.projectId) {
    return '';
  }
  if (scope.motionNodeId) {
    return `/api/v1/projects/${scope.projectId}/motion/${scope.motionNodeId}/agent`;
  }
  return `/api/v1/projects/${scope.projectId}/agent`;
}
