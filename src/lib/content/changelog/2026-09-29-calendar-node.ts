import type { ChangelogEntry } from './index';

export default {
	date: '2026-09-29',
	title: 'Plan drafts on a calendar inside the canvas',
	items: [
		'Add a Calendar node from More nodes to see this canvas’s drafts, or a whole brand’s, by week or month.',
		'Drop selected nodes on a day to turn them into a draft planned for that day.',
		'Drag a draft to another day to re-plan it; open it to edit or schedule it at its planned time.',
		'The Calendar page shows planned drafts too, dashed until they are scheduled.'
	]
} satisfies ChangelogEntry;
