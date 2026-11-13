export const CREDITS_PER_EUR = 100;

const MIN_DISPLAYED_CREDITS = 1;
const MIN_DISPLAYED_PRICE = 0.01;

export function formatCredits(units: number, { approx = false }: { approx?: boolean } = {}): string {
  const prefix = approx ? '~' : '';

  if (units > 0 && units < MIN_DISPLAYED_CREDITS) {
    return `${prefix}<${MIN_DISPLAYED_CREDITS}`;
  }

  return `${prefix}${Math.round(units).toLocaleString('en-US')}`;
}

export function formatPrice(units: number): string {
  const value = units / CREDITS_PER_EUR;
  if (value > 0 && value < MIN_DISPLAYED_PRICE) {
    return `< €${MIN_DISPLAYED_PRICE.toFixed(2)}`;
  }
  return `€${value.toFixed(2)}`;
}
