import { LIGHT, type Declared } from './css-tokens';
import type { ReadFile } from './write-back';

export type SassRead = { declared: Declared[]; skipped: string[] };

const FOLDERS = ['src/styles', 'styles', 'src/scss', 'src/assets/scss', 'src/assets/styles', 'src'];
const NAMES = ['_variables', 'variables'];
const EXTENSIONS = ['scss', 'less'];
const MAX_BYTES = 256 * 1024;

export const SASS_FILE = /\.(scss|less)$/;

const DECLARATION = /^(\s*)([$@])([\w-]+)(\s*:\s*)(.+?)\s*(?:!default\s*)?;\s*(?:\/\/.*)?$/;
const REFERENCE = /^[$@]([\w-]+)$/;
const COMPUTED = /[$@]|\b(?!(?:rgba?|hsla?|oklch|oklab|calc|var|url)\()[\w-]+\(|[*/+](?!\s*\d)/;
const VAR_FUNCTION = /^(?:rgba?|hsla?|oklch|oklab)\(.*\)$/;
const COMMENT_MARK = /\/\*[\s\S]*?\*\//g;

const CANDIDATES = FOLDERS.flatMap((folder) => NAMES.flatMap((name) => EXTENSIONS.map((ext) => `${folder}/${name}.${ext}`)));

const blanked = (text: string) => text.replace(COMMENT_MARK, (c) => c.replace(/[^\n]/g, ' '));

export function readSassText(text: string, file: string): SassRead {
  const out: SassRead = { declared: [], skipped: [] };
  blanked(text).split('\n').forEach((line, i) => {
    const m = DECLARATION.exec(line);
    if (!m) {
      return;
    }
    const [, indent, , name, colon, value] = m;
    const reference = REFERENCE.exec(value);
    const literal = !COMPUTED.test(value) || VAR_FUNCTION.test(value);
    if (!reference && !literal) {
      out.skipped.push(`--${name}: ${file}:${i + 1} is a Sass expression, not a literal`);
      return;
    }
    out.declared.push({ name: `--${name}`, raw: reference ? `var(--${reference[1]})` : value, mode: LIGHT, at: { file, line: i + 1, column: indent.length + 1 + name.length + colon.length } });
  });
  return out;
}

export async function readSassVars(read: ReadFile): Promise<SassRead> {
  const texts = await Promise.all(CANDIDATES.map(async (path) => ({ path, text: await read(path).catch(() => null) })));
  const found = texts.flatMap(({ path, text }) => (text === null || text.length > MAX_BYTES ? [] : [readSassText(text, path)]));
  return { declared: found.flatMap((f) => f.declared), skipped: found.flatMap((f) => f.skipped) };
}
