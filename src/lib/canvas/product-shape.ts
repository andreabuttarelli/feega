export type ProductVariant = {
  id: string;
  title: string;
  sku: string | null;
  price: number | null;
  compare_at_price: number | null;
  available: boolean | null;
  options: Record<string, string>;
  image: string | null;
};

export type ProductOptions = Record<string, string[]>;
