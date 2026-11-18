import type { LayoutLoad } from './$types';
import { loadBrandShell } from '$lib/settings/api';
import type { BrandShell } from '$lib/server/settings/event';
import type { load as shellLoad } from '$lib/server/settings/shell';

type BrandSettingsShell = Omit<Awaited<ReturnType<typeof shellLoad>>, 'brand'> & Pick<BrandShell, 'brand'>;

export const load: LayoutLoad = ({ params, url, depends }) => loadBrandShell<BrandSettingsShell>(params.brandId, url, depends);
