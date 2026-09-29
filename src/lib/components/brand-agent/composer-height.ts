export const COMPOSER_MAX_HEIGHT_PX = 200;

export function composerHeight(scrollHeight: number): string {
  if (scrollHeight === 0) {
    return '';
  }
  return `${Math.min(scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
}
