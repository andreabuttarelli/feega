import type { Db } from '$lib/server/db/client';
import { findBrand, findBrandLook, listOrgBrands, type Brand } from '$lib/server/repos/brands';
import { listBrandProducts } from '$lib/server/repos/products';
import { paletteFrom } from '$lib/motion/brand';
import { fontsFrom } from '$lib/motion/fonts/model';
import { GOOGLE_FONTS } from '$lib/motion/fonts/catalogue';

const PRODUCTS_MAX = 12;
const VOICE_MAX = 2000;

export type BrandBrief = {
  name: string;
  website: string | null;
  description: string | null;
  logoUrl: string | null;
  palette: string[];
  fonts: string[];
  voice: string | null;
  products: { name: string; price: string | null; url: string | null; image: string | null }[];
};
export type BrandRead = { ok: true; brand: BrandBrief } | { ok: false; error: string };

const sameName = (brand: Brand, name: string) => [brand.name, brand.slug].some((n) => n.toLowerCase() === name.trim().toLowerCase());

async function pick(db: Db, scope: { orgId: string; brandId: string | null }, name?: string): Promise<Brand | string> {
  if (!name && scope.brandId) {
    return (await findBrand(db, { orgId: scope.orgId, brandId: scope.brandId })) ?? 'the project brand is not readable';
  }
  const brands = await listOrgBrands(db, scope.orgId);
  const named = name ? brands.find((b) => sameName(b, name)) : undefined;
  if (named) {
    return named;
  }
  const choices = brands.length ? `brands of this workspace: ${brands.map((b) => b.name).join(', ')}` : 'this workspace has no brand: use analyze_site on its website instead';
  return `${name ? `no brand called "${name}"` : 'this project has no brand'}; ${choices}`;
}

export async function readBrand(db: Db, scope: { orgId: string; brandId: string | null }, name?: string): Promise<BrandRead> {
  const brand = await pick(db, scope, name);
  if (typeof brand === 'string') {
    return { ok: false, error: brand };
  }
  const [look, products] = await Promise.all([findBrandLook(db, { orgId: scope.orgId, brandId: brand.id }), listBrandProducts(db, { orgId: scope.orgId, brandId: brand.id, limit: PRODUCTS_MAX })]);
  const content = look?.content ?? null;

  return {
    ok: true,
    brand: {
      name: brand.name,
      website: brand.website,
      description: brand.shortDescription,
      logoUrl: brand.logoUrl,
      palette: paletteFrom(content),
      fonts: fontsFrom(content, GOOGLE_FONTS),
      voice: content ? content.slice(0, VOICE_MAX) : null,
      products: products.map((p) => ({ name: p.title, price: p.price === null ? null : [p.price, p.currency].filter(Boolean).join(' '), url: p.url, image: p.images[0]?.url ?? null }))
    }
  };
}
