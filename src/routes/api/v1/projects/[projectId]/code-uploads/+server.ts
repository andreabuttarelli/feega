import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { CODE_IMPORT_STATUS, CodeImportOutcome } from '$lib/server/code-import/import-code';
import { signCodeUpload } from '$lib/server/code-import/upload-source';
import { projectScopeOf } from '$lib/server/projects/project-scope';
import type { RequestHandler } from './$types';

const askSchema = z.object({ name: z.string().min(1).max(60) });

export const POST: RequestHandler = async (event) => {
  const scope = await projectScopeOf(event);
  if (scope instanceof Response) {
    return scope;
  }

  const ask = askSchema.safeParse(await event.request.json().catch(() => null));
  const signed = ask.success ? await signCodeUpload(scope.db, scope, ask.data.name) : null;
  return signed ? json(signed) : json({ error: CodeImportOutcome.Invalid }, { status: CODE_IMPORT_STATUS[CodeImportOutcome.Invalid] });
};
