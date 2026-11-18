import { movedToDashboard } from '$lib/components/settings/platforms';

export function match(param: string): boolean {
  return movedToDashboard(param);
}
