export enum Environment {
  WhiteEcom = 'white_ecom',
  SoftStudio = 'soft_studio',
  Marble = 'marble',
  LifestyleKitchen = 'lifestyle_kitchen',
  Outdoor = 'outdoor',
  UrbanStreet = 'urban_street',
  Beach = 'beach',
  Seasonal = 'seasonal'
}

export type EnvironmentPreset = { label: string; hint: string; preview: string; scene: string };

export const ENVIRONMENTS: Readonly<Record<Environment, EnvironmentPreset>> = {
  [Environment.WhiteEcom]: {
    label: 'White e-commerce',
    hint: 'Marketplace-ready, pure white',
    preview: '/studio/styles/white_ecom.webp',
    scene: 'pure white seamless background (#FFFFFF), even shadowless softbox lighting, centred subject, marketplace-compliant'
  },
  [Environment.SoftStudio]: {
    label: 'Soft studio',
    hint: 'Warm paper, soft shadow',
    preview: '/studio/styles/soft_studio.webp',
    scene: 'warm neutral paper backdrop, large diffused key light from the left, soft natural shadow'
  },
  [Environment.Marble]: {
    label: 'Marble',
    hint: 'Premium, editorial',
    preview: '/studio/styles/marble.webp',
    scene: 'white Carrara marble surface, soft daylight from a window, subtle reflections, premium editorial look'
  },
  [Environment.LifestyleKitchen]: {
    label: 'Lifestyle kitchen',
    hint: 'Bright home, morning light',
    preview: '/studio/styles/lifestyle_kitchen.webp',
    scene: 'bright modern kitchen, light wood countertop, morning daylight, shallow depth of field'
  },
  [Environment.Outdoor]: {
    label: 'Outdoor',
    hint: 'Park, golden hour',
    preview: '/studio/styles/outdoor.webp',
    scene: 'natural park setting, golden-hour sunlight, green foliage softly blurred in the background'
  },
  [Environment.UrbanStreet]: {
    label: 'Urban street',
    hint: 'City, concrete and glass',
    preview: '/studio/styles/urban_street.webp',
    scene: 'contemporary city street, concrete and glass, overcast soft light, editorial street-style framing'
  },
  [Environment.Beach]: {
    label: 'Beach',
    hint: 'Sun, sand and sea',
    preview: '/studio/styles/beach.webp',
    scene: 'sunny sandy beach, turquoise sea in the background, bright midday light with soft fill'
  },
  [Environment.Seasonal]: {
    label: 'Seasonal',
    hint: 'Holiday lights, festive',
    preview: '/studio/styles/seasonal.webp',
    scene: 'tasteful seasonal holiday set, warm bokeh lights, muted festive props kept away from the product'
  }
};

export function isEnvironment(value: string): value is Environment {
  return value in ENVIRONMENTS;
}
