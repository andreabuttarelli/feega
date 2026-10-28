import { TokenKind, type PageSpec, type Token } from '../ir';
import { variableOf } from './css';

const THEMED: ReadonlySet<TokenKind> = new Set([TokenKind.Colour, TokenKind.Font, TokenKind.Radius]);

export function themeCss(tokens: readonly Token[]): string {
  const lines = tokens.filter((t) => THEMED.has(t.kind)).map((t) => `  ${variableOf(t)}: ${t.value};`);
  return ['@theme {', ...lines, '}', ''].join('\n');
}

function assetLines(page: PageSpec): string[] {
  if (!page.assets.length) {
    return [];
  }
  return [
    '## Assets',
    '',
    'Images point at the URLs they had when exported. Signed links expire: download each file into the project and update the reference before shipping.',
    '',
    ...page.assets.map((a) => `- \`${a.id}\`: ${a.url ?? 'no URL at export time'}`),
    ''
  ];
}

function noteLines(page: PageSpec): string[] {
  return page.notes.length ? ['## Not exported', '', ...page.notes.map((n) => `- ${n}`), ''] : [];
}

export function readme(page: PageSpec, stack: string, steps: readonly string[], componentsDir: string): string {
  const components = page.components.map((c) => `- \`${c.name}\`${c.props.length ? `: ${c.props.map((p) => p.name).join(', ')}` : ''}`);
  return [
    `# ${page.name}`,
    '',
    `Exported from feega as ${stack}.`,
    '',
    '```bash',
    ...steps,
    '```',
    '',
    ...(components.length ? [`## Components (\`${componentsDir}\`)`, '', ...components, ''] : []),
    ...assetLines(page),
    ...noteLines(page)
  ].join('\n');
}
