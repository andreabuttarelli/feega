export const STUDIO_MIN_AGE = 21;

export enum ModelVerdict {
  Allowed = 'allowed',
  UploadedPhotos = 'uploaded_photos',
  UnknownAge = 'unknown_age',
  UnderAge = 'under_age'
}

export const MODEL_VERDICT_TEXT: Readonly<Record<ModelVerdict, string>> = {
  [ModelVerdict.Allowed]: '',
  [ModelVerdict.UploadedPhotos]: 'Built from uploaded photos, so it may be a real person.',
  [ModelVerdict.UnknownAge]: `Set an apparent age of ${STUDIO_MIN_AGE} or more first.`,
  [ModelVerdict.UnderAge]: `Studio models must look ${STUDIO_MIN_AGE} or older.`
};

export type ModelFacts = { source: string; age: number | null };

const SOURCE_VERDICT: Readonly<Record<string, ModelVerdict>> = {
  upload: ModelVerdict.UploadedPhotos
};

export function castingVerdict(model: ModelFacts): ModelVerdict {
  const bySource = SOURCE_VERDICT[model.source];
  if (bySource) {
    return bySource;
  }
  if (model.age === null) {
    return ModelVerdict.UnknownAge;
  }
  return model.age < STUDIO_MIN_AGE ? ModelVerdict.UnderAge : ModelVerdict.Allowed;
}

const KIDS_WORDS = ['kid', 'kids', 'child', 'children', 'baby', 'babies', 'toddler', 'infant', 'junior', 'boys', 'girls', 'bambino', 'bambina', 'bambini', 'neonato'];

export type ProductFacts = { title: string; productType: string | null; tags: string[] };

export function isKidsProduct(product: ProductFacts): boolean {
  const words = [product.title, product.productType ?? '', ...product.tags]
    .join(' ')
    .toLowerCase()
    .split(/[^a-zà-ù]+/);
  return words.some((word) => KIDS_WORDS.includes(word));
}
