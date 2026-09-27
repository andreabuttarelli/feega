import type { Db } from '$lib/server/db/client';
import type { SocialPublisher } from '$lib/server/publishing/port';
import type { Brand } from '$lib/server/repos/brands';
import type { SocialAccount } from '$lib/server/repos/social-accounts';
import type { Post } from '$lib/server/repos/posts';
import type { AccountDeliveryStatus } from '$lib/server/repos/post-delivery';

export const ALL_BRANDS = 'all';

export type CalendarPost = Post & { deliveries: AccountDeliveryStatus[] };

export type CalendarData = {
  brands: Brand[];
  selection: string;
  accountsByBrand: Record<string, SocialAccount[]>;
  posts: CalendarPost[];
};

type CalendarRepos = {
  listOrgBrands: (db: Db, orgId: string) => Promise<Brand[]>;
  listBrandAccounts: (db: Db, input: { orgId: string; brandId: string }) => Promise<SocialAccount[]>;
  listPosts: (db: Db, scope: { orgId: string; brandId: string }) => Promise<Post[]>;
  deliveryStatus: (
    db: Db,
    publisher: SocialPublisher,
    input: { orgId: string; postId: string }
  ) => Promise<AccountDeliveryStatus[]>;
};

type CalendarInput = { orgId: string; brandParam: string | null; db: Db; publisher: SocialPublisher };

export async function buildCalendarData(repos: CalendarRepos, input: CalendarInput): Promise<CalendarData> {
  const brands = await repos.listOrgBrands(input.db, input.orgId);
  const picked = brands.find((b) => b.slug === input.brandParam);
  const shown = picked ? [picked] : brands;

  const [accountLists, postLists] = await Promise.all([
    Promise.all(brands.map((b) => repos.listBrandAccounts(input.db, { orgId: input.orgId, brandId: b.id }))),
    Promise.all(shown.map((b) => repos.listPosts(input.db, { orgId: input.orgId, brandId: b.id })))
  ]);

  const accountsByBrand = Object.fromEntries(brands.map((b, i) => [b.id, accountLists[i]]));

  const posts = await Promise.all(
    postLists.flat().map(async (post) => ({ ...post, deliveries: await deliveriesOrEmpty(repos, input, post.id) }))
  );

  return { brands, selection: picked?.slug ?? ALL_BRANDS, accountsByBrand, posts };
}

async function deliveriesOrEmpty(repos: CalendarRepos, input: CalendarInput, postId: string): Promise<AccountDeliveryStatus[]> {
  try {
    return await repos.deliveryStatus(input.db, input.publisher, { orgId: input.orgId, postId });
  } catch {
    return [];
  }
}
