import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Paste a website, get it as a design',
  items: ['Paste any website on feega.app and it opens on a new canvas as an editable design, without waiting on a loading page.', 'A website import no longer fails as a whole when one component set can’t be saved: the page lands and the import names what was left out.']
} satisfies ChangelogEntry;
