import { error, json } from '@sveltejs/kit';
import all from 'virtual:changelog-entries';
import { changelogPage, changelogPageCount } from '$lib/site/changelog-pages';
import type { EntryGenerator, RequestHandler } from './$types';

const NOT_FOUND = 404;
const FIRST_LATER_PAGE = 2;

export const prerender = changelogPageCount(all) >= FIRST_LATER_PAGE;

export const entries: EntryGenerator = () =>
  Array.from({ length: changelogPageCount(all) - 1 }, (_, i) => ({ page: String(i + FIRST_LATER_PAGE) }));

export const GET: RequestHandler = ({ params }) => {
  const page = Number(params.page);
  if (!Number.isInteger(page) || page < FIRST_LATER_PAGE || page > changelogPageCount(all)) {
    error(NOT_FOUND, 'No such changelog page');
  }

  return json(changelogPage(all, page));
};
