import type { ChangelogEntry } from './index';

export default {
	date: '2026-09-27',
	title: 'You land on the project you were working on',
	items: [
		'Signing in now takes you back to the project you last opened, instead of the newest one.',
		'Fixed a rare race that could create an extra empty project during sign-in.',
		'Calendar now works normally on a project without a brand yet, instead of a dead end.',
		'The project switcher shows when each project was last edited, so same-named ones are easy to tell apart.'
	]
} satisfies ChangelogEntry;
