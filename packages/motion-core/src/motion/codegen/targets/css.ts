import { isRef, TokenKind, type CssValue, type MediaRules, type Rule, type Token } from '../ir';
import { tokenIndex, tokenKey } from '../tokens';

export const TOKEN_PREFIX: Record<TokenKind, string> = {
  [TokenKind.Colour]: 'color',
  [TokenKind.Font]: 'font',
  [TokenKind.Space]: 'space',
  [TokenKind.Radius]: 'radius'
};

export type TokenLookup = Map<string, Token>;

export const lookupOf = tokenIndex;

export const variableOf = (token: Token) => `--${TOKEN_PREFIX[token.kind]}-${token.name}`;

export function cssValue(value: CssValue, tokens: TokenLookup): string {
  if (!isRef(value)) {
    return value;
  }
  const token = tokens.get(tokenKey(value.token, value.raw));
  const core = token ? `var(${variableOf(token)})` : value.raw;
  return `${value.before ?? ''}${core}${value.after ?? ''}`;
}

const INDENT = '  ';

export function ruleBlock(selector: string, rules: readonly Rule[], tokens: TokenLookup, indent = ''): string[] {
  if (!rules.length) {
    return [];
  }
  return [`${indent}${selector} {`, ...rules.map(([p, v]) => `${indent}${INDENT}${p}: ${cssValue(v, tokens)};`), `${indent}}`];
}

export function mediaBlocks(selector: string, media: readonly MediaRules[] | undefined, tokens: TokenLookup, indent = ''): string[] {
  return (media ?? []).flatMap((m) => [`${indent}@media (max-width: ${m.maxWidth}px) {`, ...ruleBlock(selector, m.rules, tokens, `${indent}${INDENT}`), `${indent}}`, '']);
}

export function tokensCss(tokens: readonly Token[], selector = ':root'): string {
  const lines = tokens.map((t) => `  ${variableOf(t)}: ${t.value};`);
  return [`${selector} {`, ...lines, '}', ''].join('\n');
}

export const BASE_CSS = [
  '*,',
  '*::before,',
  '*::after {',
  '  box-sizing: border-box;',
  '}',
  '',
  'body {',
  '  margin: 0;',
  '  -webkit-font-smoothing: antialiased;',
  '}',
  '',
  'h1, h2, h3, p, ul {',
  '  margin: 0;',
  '}',
  '',
  'ul {',
  '  padding: 0;',
  '  list-style: none;',
  '}',
  '',
  'img, svg, video {',
  '  display: block;',
  '  max-width: 100%;',
  '}',
  '',
  'button {',
  '  font: inherit;',
  '  color: inherit;',
  '  border: 0;',
  '  background: none;',
  '  cursor: pointer;',
  '}',
  '',
  'a {',
  '  color: inherit;',
  '  text-decoration: none;',
  '}',
  ''
].join('\n');

const GOOGLE_FONTS = 'https://fonts.googleapis.com/css2';
const WEIGHTS = 'wght@300;400;500;600;700;800';

export function fontLinks(tokens: readonly Token[]): string[] {
  const families = tokens.filter((t) => t.kind === TokenKind.Font).map((t) => `family=${encodeURIComponent(t.raw).replace(/%20/g, '+')}:${WEIGHTS}`);
  if (!families.length) {
    return [];
  }
  return [
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    `<link rel="stylesheet" href="${GOOGLE_FONTS}?${families.join('&')}&display=swap" />`
  ];
}
