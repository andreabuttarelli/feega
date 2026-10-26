export enum Material {
  Original = 'original',
  Metal = 'metal',
  Chrome = 'chrome',
  Glass = 'glass',
  Plastic = 'plastic',
  Matte = 'matte'
}

export const MATERIALS = Object.values(Material) as [Material, ...Material[]];

export type Surface = { metalness: number; roughness: number; transmission: number; thickness: number; ior: number; clearcoat: number; clearcoatRoughness: number };

const SURFACE_BASE: Surface = { metalness: 0, roughness: 0.5, transmission: 0, thickness: 0, ior: 1.5, clearcoat: 0, clearcoatRoughness: 0 };

export const SURFACE: Record<Material, Surface | null> = {
  [Material.Original]: null,
  [Material.Metal]: { ...SURFACE_BASE, metalness: 1, roughness: 0.28 },
  [Material.Chrome]: { ...SURFACE_BASE, metalness: 1, roughness: 0.04 },
  [Material.Glass]: { ...SURFACE_BASE, roughness: 0.04, transmission: 1, thickness: 0.6 },
  [Material.Plastic]: { ...SURFACE_BASE, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12 },
  [Material.Matte]: { ...SURFACE_BASE, roughness: 0.95 }
};
