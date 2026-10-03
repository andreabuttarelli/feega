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

export type EnvironmentPreset = { label: string; scene: string };

export const ENVIRONMENTS: Readonly<Record<Environment, EnvironmentPreset>> = {
  [Environment.WhiteEcom]: {
    label: 'White e-commerce',
    scene: 'pure white seamless background (#FFFFFF), even shadowless softbox lighting, centred subject, marketplace-compliant'
  },
  [Environment.SoftStudio]: {
    label: 'Soft studio',
    scene: 'warm neutral paper backdrop, large diffused key light from the left, soft natural shadow'
  },
  [Environment.Marble]: {
    label: 'Marble',
    scene: 'white Carrara marble surface, soft daylight from a window, subtle reflections, premium editorial look'
  },
  [Environment.LifestyleKitchen]: {
    label: 'Lifestyle kitchen',
    scene: 'bright modern kitchen, light wood countertop, morning daylight, shallow depth of field'
  },
  [Environment.Outdoor]: {
    label: 'Outdoor',
    scene: 'natural park setting, golden-hour sunlight, green foliage softly blurred in the background'
  },
  [Environment.UrbanStreet]: {
    label: 'Urban street',
    scene: 'contemporary city street, concrete and glass, overcast soft light, editorial street-style framing'
  },
  [Environment.Beach]: {
    label: 'Beach',
    scene: 'sunny sandy beach, turquoise sea in the background, bright midday light with soft fill'
  },
  [Environment.Seasonal]: {
    label: 'Seasonal',
    scene: 'tasteful seasonal holiday set, warm bokeh lights, muted festive props kept away from the product'
  }
};

export function isEnvironment(value: string): value is Environment {
  return value in ENVIRONMENTS;
}
