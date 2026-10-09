import { unzipSync, strFromU8 } from 'fflate';
import { extOf } from '$lib/chat-attachments';
import { convertFileToMarkdown } from '$lib/server/file-to-markdown';

export const ATTACHMENT_TEXT_CAP = 60_000;

const SLIDE_PATH = /^ppt\/slides\/slide(\d+)\.xml$/;
const PARAGRAPH = /<a:p\b[\s\S]*?<\/a:p>/g;
const RUN_TEXT = /<a:t>([\s\S]*?)<\/a:t>/g;

const XML_ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };

const unescapeXml = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m]);

function slideText(xml: string): string {
  return (xml.match(PARAGRAPH) ?? [])
    .map((p) => [...p.matchAll(RUN_TEXT)].map((m) => unescapeXml(m[1])).join(''))
    .filter((line) => line.trim())
    .join('\n');
}

export function pptxToMarkdown(buf: ArrayBuffer): string {
  const files = unzipSync(new Uint8Array(buf), { filter: (f) => SLIDE_PATH.test(f.name) });
  return Object.keys(files)
    .map((name) => ({ n: Number(SLIDE_PATH.exec(name)![1]), xml: strFromU8(files[name]) }))
    .sort((a, b) => a.n - b.n)
    .map((s) => `## Slide ${s.n}\n\n${slideText(s.xml)}`)
    .join('\n\n');
}

const CONVERTERS: Record<string, (buf: ArrayBuffer) => Promise<string> | string> = { pptx: pptxToMarkdown };

function capped(markdown: string): string {
  if (markdown.length <= ATTACHMENT_TEXT_CAP) {
    return markdown;
  }
  return `${markdown.slice(0, ATTACHMENT_TEXT_CAP).trimEnd()}\n\n_Truncated: showing ${ATTACHMENT_TEXT_CAP.toLocaleString('en')} of ${markdown.length.toLocaleString('en')} characters._`;
}

export async function attachmentMarkdown(buf: ArrayBuffer, mimeType: string, name: string): Promise<string> {
  const own = CONVERTERS[extOf(name)];
  const markdown = own ? await own(buf) : (await convertFileToMarkdown(buf, mimeType, name)).markdown;
  if (!markdown.trim()) {
    throw new Error('No extractable text in this file.');
  }
  return capped(markdown);
}
