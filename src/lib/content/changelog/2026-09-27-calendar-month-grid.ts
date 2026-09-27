import type { ChangelogEntry } from './index';

export default {
	date: '2026-09-27',
	title: 'Calendar now shows a real month view',
	items: [
		'Calendar shows posts on the day they are scheduled, in a month grid you can browse.',
		'Move between months, or jump back to today, in one click.',
		'Drafts without a date show in a separate list instead of mixing with scheduled posts.'
	]
} satisfies ChangelogEntry;
