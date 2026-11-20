import { inVscode } from './host';

export enum ImageSource {
  Host = 'host',
  Browser = 'browser'
}

export const imageSource = inVscode ? ImageSource.Host : ImageSource.Browser;

export const imageSaved = $state({ url: '' });

export function readAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
