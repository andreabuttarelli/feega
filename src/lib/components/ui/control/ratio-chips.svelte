<script lang="ts" module>
	export const RATIO_GLYPH_MAX_PX = 12;

	export function ratioBox(ratio: string): { width: number; height: number } | null {
		const [w, h] = ratio.split(":").map(Number);
		if (!w || !h) {
			return null;
		}
		const scale = RATIO_GLYPH_MAX_PX / Math.max(w, h);
		return { width: Math.max(2, Math.round(w * scale)), height: Math.max(2, Math.round(h * scale)) };
	}
</script>

<script lang="ts">
	import Segmented from "./segmented.svelte";
	import type { ControlProps } from "./types";

	let props: ControlProps = $props();
</script>

<Segmented {...props}>
	{#snippet glyph(option)}
		{@const box = ratioBox(option.value)}
		{#if box}
			<span aria-hidden="true" class="inline-block shrink-0 border border-current" style={`width:${box.width}px;height:${box.height}px`}></span>
		{/if}
	{/snippet}
</Segmented>
