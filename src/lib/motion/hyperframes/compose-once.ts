import type { ComposeInput } from './compose';

function sameFields(a: ComposeInput, b: ComposeInput): boolean {
  const keys = Object.keys(a) as (keyof ComposeInput)[];
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

export function lastComposed(compose: (input: ComposeInput) => string): (input: ComposeInput) => string {
  let last: { input: ComposeInput; html: string } | null = null;
  return (input) => {
    if (last && sameFields(last.input, input)) {
      return last.html;
    }
    last = { input, html: compose(input) };
    return last.html;
  };
}
