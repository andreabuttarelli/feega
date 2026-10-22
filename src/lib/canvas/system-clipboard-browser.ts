import { HTML_MIME, SVG_MIME, TEXT_MIME, type PasteSource } from '$lib/canvas/system-clipboard';

async function withSvgText(source: PasteSource<File>): Promise<PasteSource<File>> {
  const svg = source.text ? null : source.files.find((f) => f.type === SVG_MIME);
  return svg ? { ...source, text: await svg.text() } : source;
}

export function eventSource(data: DataTransfer): Promise<PasteSource<File>> {
  return withSvgText({ html: data.getData(HTML_MIME), text: data.getData(TEXT_MIME), files: [...data.files] });
}

const blobText = async (item: ClipboardItem, type: string) => (item.types.includes(type) ? (await item.getType(type)).text() : '');

export async function systemSource(): Promise<PasteSource<File> | null> {
  const items = await navigator.clipboard?.read?.().catch(() => null);
  if (!items?.length) {
    return null;
  }
  const source: PasteSource<File> = { html: '', text: '', files: [] };
  for (const item of items) {
    source.html ||= await blobText(item, HTML_MIME);
    source.text ||= await blobText(item, TEXT_MIME);
    for (const type of item.types.filter((t) => t.startsWith('image/'))) {
      const blob = await item.getType(type);
      source.files.push(new File([blob], `pasted.${type.split('/')[1].replace('+xml', '')}`, { type }));
    }
  }
  return withSvgText(source);
}

export async function writeSystem(html: string, text: string): Promise<boolean> {
  const write = navigator.clipboard?.write?.bind(navigator.clipboard);
  if (!write) {
    return false;
  }
  const item = new ClipboardItem({ [HTML_MIME]: new Blob([html], { type: HTML_MIME }), [TEXT_MIME]: new Blob([text], { type: TEXT_MIME }) });
  return write([item]).then(
    () => true,
    () => false
  );
}
