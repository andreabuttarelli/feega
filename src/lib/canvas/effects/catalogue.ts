import { EFFECTS } from './index';
import type { EffectId, EffectParam } from './types';

export type EffectEntry = { id: EffectId; label: string; description?: string; params: EffectParam[] };

export function effectsCatalogue(): EffectEntry[] {
	return (Object.keys(EFFECTS) as EffectId[]).map((id) => ({ id, label: EFFECTS[id].label, description: EFFECTS[id].description, params: EFFECTS[id].params }));
}
