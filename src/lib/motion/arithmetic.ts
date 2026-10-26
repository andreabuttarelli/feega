const TOKEN = /\s*(\d+(?:\.\d*)?|\.\d+|[-+*/^()])/y;

function tokenize(text: string): string[] | null {
  const tokens: string[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < text.length) {
    const start = TOKEN.lastIndex;
    const match = TOKEN.exec(text);
    if (!match) {
      return text.slice(start).trim() ? null : tokens;
    }
    tokens.push(match[1]);
  }
  return tokens;
}

class Parser {
  private at = 0;

  constructor(private readonly tokens: string[]) {}

  run(): number | null {
    const value = this.sum();
    return value !== null && this.at === this.tokens.length ? value : null;
  }

  private peek(): string | undefined {
    return this.tokens[this.at];
  }

  private sum(): number | null {
    let left = this.product();
    while (left !== null && (this.peek() === '+' || this.peek() === '-')) {
      const op = this.tokens[this.at++];
      const right = this.product();
      if (right === null) {
        return null;
      }
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  private product(): number | null {
    let left = this.power();
    while (left !== null && (this.peek() === '*' || this.peek() === '/')) {
      const op = this.tokens[this.at++];
      const right = this.power();
      if (right === null) {
        return null;
      }
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  private power(): number | null {
    const base = this.unary();
    if (base === null || this.peek() !== '^') {
      return base;
    }
    this.at++;
    const exponent = this.power();
    return exponent === null ? null : base ** exponent;
  }

  private unary(): number | null {
    const token = this.peek();
    if (token !== '-' && token !== '+') {
      return this.atom();
    }
    this.at++;
    const value = this.unary();
    if (value === null) {
      return null;
    }
    return token === '-' ? -value : value;
  }

  private atom(): number | null {
    const token = this.tokens[this.at++];
    if (token === '(') {
      const inner = this.sum();
      return this.tokens[this.at++] === ')' ? inner : null;
    }
    const value = Number(token);
    return token !== undefined && Number.isFinite(value) ? value : null;
  }
}

export function parseDecimal(text: string): number | null {
  const tokens = tokenize(text.replaceAll(',', '.'));
  if (!tokens?.length) {
    return null;
  }
  const value = new Parser(tokens).run();
  return value !== null && Number.isFinite(value) ? value : null;
}
