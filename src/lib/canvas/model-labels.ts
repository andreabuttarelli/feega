type Labelled = { label: string; providerLabel: string };

const CODENAME = /\s*\([^()]*\)\s*$/;

function withoutVendor(label: string, providerLabel: string): string {
  const prefix = `${providerLabel}: `;
  return label.startsWith(prefix) ? label.slice(prefix.length) : label;
}

function shortLabel(choice: Labelled): string {
  const bare = withoutVendor(choice.label, choice.providerLabel).replace(CODENAME, '').trim();
  return bare || withoutVendor(choice.label, choice.providerLabel);
}

export function cleanLabels<T extends Labelled>(choices: T[]): T[] {
  const short = choices.map(shortLabel);
  const taken = (index: number) => short.filter((label, other) => label === short[index] && choices[other].providerLabel === choices[index].providerLabel).length > 1;

  return choices.map((choice, index) => ({
    ...choice,
    label: taken(index) ? withoutVendor(choice.label, choice.providerLabel) : short[index]
  }));
}
