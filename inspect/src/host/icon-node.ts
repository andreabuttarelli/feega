const NODE_LIST = /(?:\bnode\s*:|[iI]conNode\s*=)\s*(?=\[)/;
const UNQUOTED_KEY = /([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g;
const SVG_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
const REACT_KEY = 'key';
const QUOTE = '"';

type Shape = [string, Record<string, string | number>];

function balanced(text: string, start: number): string | null {
  let depth = 0;
  let quoted = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      quoted = !(char === QUOTE && text[i - 1] !== '\\');
      continue;
    }
    if (char === QUOTE) {
      quoted = true;
    }
    depth += char === '[' ? 1 : char === ']' ? -1 : 0;
    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }
  return null;
}

const attribute = ([name, value]: [string, string | number]) => ` ${name}="${String(value).replace(/"/g, '&quot;')}"`;

const shapeSvg = ([tag, attrs]: Shape) =>
  `<${tag}${Object.entries(attrs).filter(([name]) => name !== REACT_KEY).map(attribute).join('')}/>`;

export function svgOfSource(source: string): string | null {
  const found = NODE_LIST.exec(source);
  const literal = found ? balanced(source, found.index + found[0].length) : null;
  if (!literal) {
    return null;
  }

  try {
    const shapes = JSON.parse(literal.replace(UNQUOTED_KEY, `$1"$2":`)) as Shape[];
    return `${SVG_OPEN}${shapes.map(shapeSvg).join('')}</svg>`;
  } catch {
    return null;
  }
}
