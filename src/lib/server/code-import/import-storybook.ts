import { publicUrl } from '$lib/server/url-import/import-url';
import { CodeImportOutcome, Crop, importBoards, type CodeImported, type LandAsk } from './import-code';
import { MAX_STORIES, storybookBase, storybookPages } from './storybook';

export type StorybookAsk = LandAsk & { storybook: string; stories?: string[]; fetchFn?: typeof fetch };

export async function importStorybookAt(ask: StorybookAsk): Promise<CodeImported> {
  const base = storybookBase(ask.storybook);
  if (!base) {
    return { outcome: CodeImportOutcome.Invalid };
  }
  if (!(await publicUrl(base, ask.guard))) {
    return { outcome: CodeImportOutcome.Failed, error: 'the Storybook is not on a public address' };
  }

  const stories = await storybookPages(base, ask.fetchFn ?? fetch, MAX_STORIES, ask.stories);
  if (!stories?.pages.length) {
    return { outcome: CodeImportOutcome.Unreadable, error: 'no index.json or stories.json with stories' };
  }

  return importBoards({ ...ask, name: new URL(base).hostname, pages: stories.pages, names: stories.names, crop: Crop.Content });
}
