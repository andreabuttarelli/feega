const TEXT_EXTS = new Set(['txt', 'md', 'markdown']);
const CSV_EXTS = new Set(['csv']);
const HTML_EXTS = new Set(['html', 'htm']);

function ext(fileName: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(fileName);
  return m ? m[1].toLowerCase() : '';
}

export async function toMarkdown(
  buf: ArrayBuffer,
  mime: string,
  name: string
): Promise<{ markdown: string; pages?: number; title?: string | null }> {
  const { convertFileToMarkdown } = await import('$lib/server/file-to-markdown');
  return convertFileToMarkdown(buf, mime, name);
}

export async function toMarkdownFallback(
  buf: ArrayBuffer,
  mime: string,
  name: string
): Promise<{ markdown: string; pages?: number }> {
  const e = ext(name);

  if (TEXT_EXTS.has(e) || mime === 'text/plain' || mime === 'text/markdown') {
    const text = new TextDecoder().decode(buf).replace(/\r\n/g, '\n').trim();
    return { markdown: text };
  }

  if (CSV_EXTS.has(e) || mime === 'text/csv') {
    return { markdown: csvToMarkdown(new TextDecoder().decode(buf)) };
  }

  if (HTML_EXTS.has(e) || mime === 'text/html') {
    const html = new TextDecoder().decode(buf);
    return { markdown: await htmlToMarkdown(html) };
  }

  if (e === 'pdf' || mime === 'application/pdf') {
    const { extractText: pdfExtract, getDocumentProxy } = await import('unpdf');
    const doc = await getDocumentProxy(new Uint8Array(buf));
    const { text, totalPages } = await pdfExtract(doc, { mergePages: false });
    const pages = Array.isArray(text) ? text : [String(text ?? '')];
    const parts: string[] = [];
    pages.forEach((p, i) => {
      const body = String(p ?? '').trim();
      if (!body) return;
      parts.push(`## p. ${i + 1}\n\n${body}`);
    });
    const markdown = parts.join('\n\n').trim();
    if (!markdown) throw new Error('No extractable text — need a PDF with selectable text (no OCR).');
    return { markdown, pages: typeof totalPages === 'number' ? totalPages : pages.length };
  }

  if (e === 'docx' || mime.includes('wordprocessingml')) {
    throw new Error('Could not convert this Word document.');
  }

  throw new Error(`Unsupported document type: ${mime || name}`);
}

function csvToMarkdown(raw: string): string {
  const lines = raw.replace(/\r\n/g, '\n').trim().split('\n').filter(Boolean);
  if (!lines.length) return '';
  const limit = lines.length > 200 ? 50 : lines.length;
  const slice = lines.slice(0, limit);
  const rows = slice.map((l) => l.split(',').map((c) => c.trim().replace(/\|/g, '\\|')));
  const header = rows[0];
  const sep = header.map(() => '---');
  const body = rows.slice(1).map((r) => `| ${r.join(' | ')} |`);
  let md = `| ${header.join(' | ')} |\n| ${sep.join(' | ')} |\n${body.join('\n')}`;
  if (lines.length > 200) md += `\n\n_Truncated: showing first 50 of ${lines.length} rows._`;
  return md;
}

const CHROME_TAGS: ReadonlySet<string> = new Set(['script', 'style', 'noscript', 'svg', 'button']);

export async function htmlToMarkdown(html: string): Promise<string> {
  const TurndownService = (await import('turndown')).default;
  const { gfm } = await import('turndown-plugin-gfm');
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-'
  });
  td.use(gfm);
  td.remove((node) => CHROME_TAGS.has(node.nodeName.toLowerCase()));
  td.addRule('bare-pre', {
    filter: (node) => node.nodeName === 'PRE' && !node.querySelector('code'),
    replacement: (_content, node) => `\n\n\`\`\`\n${(node.textContent ?? '').trim()}\n\`\`\`\n\n`
  });
  return td.turndown(html.replace(/<\/(span|code|strong|b|em|a|kbd)>(?=<[a-z])/gi, '$& ')).trim();
}
