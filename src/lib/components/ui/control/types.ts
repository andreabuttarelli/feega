export type ControlOption = { value: string; label: string };

export type ControlPrimitive = string | number | boolean;

export type ControlProps = {
	label: string;
	value: ControlPrimitive | null;
	mixed?: boolean;
	options?: ControlOption[];
	min?: number;
	max?: number;
	step?: number;
	disabled?: boolean;
	onchange: (value: ControlPrimitive) => void;
};

export const CONTROL_ROW = "min-h-11 md:min-h-8";
export const CONTROL_HEIGHT = "h-11 md:h-8";
export const MIXED_TEXT = "Mixed";
export const DEFAULT_TEXT = "Auto";

export function nextIndex(current: number, key: string, count: number): number | null {
	const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
	if (key === "Home") {
		return 0;
	}
	if (key === "End") {
		return count - 1;
	}
	const delta = STEP[key];
	if (delta === undefined || count === 0) {
		return null;
	}
	if (current < 0) {
		return delta > 0 ? 0 : count - 1;
	}
	return (current + delta + count) % count;
}

export type ListItem = { value: string; label: string; keywords?: string };
export type ListGroup = { id: string; label: string; items: ListItem[] };

export const SEARCH_MIN_ITEMS = 8;

export function filterGroups(groups: ListGroup[], query: string): ListGroup[] {
	const q = query.trim().toLowerCase();
	if (!q) {
		return groups;
	}
	return groups
		.map((g) => ({ ...g, items: g.items.filter((i) => `${i.label} ${i.keywords ?? ""} ${g.label}`.toLowerCase().includes(q)) }))
		.filter((g) => g.items.length);
}
