const WORDS = /[A-Za-z0-9]+/g;
const LEADING_DIGIT = /^[0-9]/;
const NAME_FALLBACK = 'layer';

const HUMP = /([a-z0-9])([A-Z])/g;

const wordsOf = (raw: string): string[] => (raw.replace(HUMP, '$1 $2').match(WORDS) ?? []).map((w) => w.toLowerCase());

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

const safeStart = (name: string, prefix: string) => (LEADING_DIGIT.test(name) ? `${prefix}${name}` : name);

export const kebab = (raw: string): string => safeStart(wordsOf(raw).join('-') || NAME_FALLBACK, 'n-');

export const pascal = (raw: string): string => safeStart(wordsOf(raw).map(capital).join('') || capital(NAME_FALLBACK), 'N');

export const camel = (raw: string): string => {
  const name = pascal(raw);
  return name.charAt(0).toLowerCase() + name.slice(1);
};

export class NameBook {
  private readonly taken = new Set<string>();

  constructor(private readonly joiner = '-') {}

  unique(name: string): string {
    let candidate = name;
    for (let n = 2; this.taken.has(candidate); n += 1) {
      candidate = `${name}${this.joiner}${n}`;
    }
    this.taken.add(candidate);
    return candidate;
  }
}
