export function discountPercent(price: number | null | undefined, compareAtPrice: number | null | undefined): number | null {
  if (price == null || compareAtPrice == null || compareAtPrice <= price) {
    return null;
  }

  const percent = Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
  return percent > 0 ? percent : null;
}

export function saleLabel(price: number | null | undefined, compareAtPrice: number | null | undefined): string | null {
  const percent = discountPercent(price, compareAtPrice);
  return percent === null ? null : `−${percent}%`;
}
