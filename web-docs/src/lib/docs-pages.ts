import { getCollection } from 'astro:content';
import type { DocPage } from './llms.js';

export const loadDocPages = async (): Promise<DocPage[]> =>
  (await getCollection('docs')).map((p) => ({ id: p.id, title: p.data.title, description: p.data.description ?? '', body: p.body ?? '' }));
