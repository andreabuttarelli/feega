export type ChatScope = { projectId?: string };

export function chatEndpoint(scope: ChatScope): string {
  if (scope.projectId) {
    return `/api/v1/projects/${scope.projectId}/agent`;
  }
  return '';
}
