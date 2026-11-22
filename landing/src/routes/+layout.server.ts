import { TEMPLATES } from '$lib/site/templates/library';
import { Tier } from '$lib/site/templates/template';

export const load = () => ({ freeTemplates: TEMPLATES.filter((t) => t.tier === Tier.Free).length });
