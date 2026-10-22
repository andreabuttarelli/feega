declare module 'virtual:changelog-entries' {
	import type { ChangelogEntry } from '$lib/content/changelog';
	const entries: ChangelogEntry[];
	export default entries;
}
