export const GALLERY_PATH = '/gallery';

export function itemPath(id: string): string {
  return `${GALLERY_PATH}/${id}`;
}
