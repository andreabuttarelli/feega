import type { Picked } from '@feega/plugin-api/protocol';

const BASE64_MARKER = ';base64,';

export function pickFile(accept: string[]): Promise<Picked | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept.join(',');
    input.addEventListener('cancel', () => resolve(null));
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, base64: String(reader.result).split(BASE64_MARKER)[1] ?? '' });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
    input.click();
  });
}
