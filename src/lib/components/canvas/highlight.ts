export enum Kind {
  Plain = 'plain',
  Comment = 'comment',
  String = 'string',
  Tag = 'tag',
  Number = 'number',
  Keyword = 'keyword',
  Property = 'property'
}

export type Token = { kind: Kind; text: string };

const RULES: [Kind, string][] = [
  [Kind.Comment, String.raw`<!--[\s\S]*?-->|/\*[\s\S]*?\*/|//[^\n]*`],
  [Kind.String, String.raw`"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|` + '`(?:\\\\.|[^`\\\\])*`'],
  [Kind.Tag, String.raw`</?[A-Za-z][\w:.-]*`],
  [Kind.Number, String.raw`#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|rem|em|%|ms|s|deg|vh|vw)?`],
  [Kind.Keyword, String.raw`\b(?:import|export|from|const|let|return|function|default|if|else|as|type|interface|await|async|true|false|null|new)\b`],
  [Kind.Property, String.raw`[A-Za-z_@$][\w$-]*(?=\s*[:=])`]
];

const MASTER = new RegExp(RULES.map(([, source]) => `(${source})`).join('|'), 'g');

function kindOfMatch(match: RegExpMatchArray): Kind {
  const group = match.slice(1).findIndex((part) => part !== undefined);
  return RULES[group][0];
}

function splitLines(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]];
  for (const token of tokens) {
    token.text.split('\n').forEach((part, i) => {
      if (i > 0) {
        lines.push([]);
      }
      if (part) {
        lines[lines.length - 1].push({ kind: token.kind, text: part });
      }
    });
  }
  return lines;
}

export function highlight(code: string): Token[][] {
  const tokens: Token[] = [];
  let cursor = 0;

  for (const match of code.matchAll(MASTER)) {
    const at = match.index ?? 0;
    if (at > cursor) {
      tokens.push({ kind: Kind.Plain, text: code.slice(cursor, at) });
    }
    tokens.push({ kind: kindOfMatch(match), text: match[0] });
    cursor = at + match[0].length;
  }

  if (cursor < code.length) {
    tokens.push({ kind: Kind.Plain, text: code.slice(cursor) });
  }

  return splitLines(tokens);
}
