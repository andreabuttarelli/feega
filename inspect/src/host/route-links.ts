const PATH = String.raw`(\/[^"'\x60$\s{}<>?#)]*)`;
const ATTRIBUTE = new RegExp(String.raw`\b(?:href|to|action|url|path)\s*[=:]\s*\{?\s*(["'\x60])${PATH}(?:[?#][^"'\x60$]*)?\1`, 'g');
const CALL = new RegExp(String.raw`\b(?:goto|push|replace|redirect|navigate)\(\s*(["'\x60])${PATH}(?:[?#][^"'\x60$]*)?\1`, 'g');
const MARKDOWN = new RegExp(String.raw`\]\(${PATH}(?:[?#][^)]*)?\)`, 'g');
const ASSET = /\.[a-z0-9]{2,5}$/i;
const PROTOCOL_RELATIVE = /^\/\//;
const TRAILING_SLASH = /\/$/;
const PATH_GROUP = 2;
const MARKDOWN_GROUP = 1;

const COMMENTS = /<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|(?<=^|\s)\/\/.*$/gm;

const pathsOf = (text: string, pattern: RegExp, group: number): string[] => [...text.matchAll(pattern)].map((match) => match[group].replace(TRAILING_SLASH, ''));

export function linksOf(source: string): string[] {
  const text = source.replace(COMMENTS, '');
  const found = [...pathsOf(text, ATTRIBUTE, PATH_GROUP), ...pathsOf(text, CALL, PATH_GROUP), ...pathsOf(text, MARKDOWN, MARKDOWN_GROUP)];

  return [...new Set(found.filter((path) => path !== '' && !PROTOCOL_RELATIVE.test(path) && !ASSET.test(path)))];
}
