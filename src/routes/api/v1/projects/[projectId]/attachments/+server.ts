import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { ATTACHMENT_PORTS, registerAttachment } from '$lib/server/chat-attachments/register';
import { answered, attachmentScope } from '$lib/server/chat-attachments/route-scope';
import type { RequestHandler } from './$types';

const bodySchema = z.object({ path: z.string().min(1).max(500), mimeType: z.string().max(200) });

export const POST: RequestHandler = async ({ request, params, locals }) => {
  const opened = await attachmentScope(locals, params.projectId ?? '');
  if (opened instanceof Response) {
    return opened;
  }
  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return json({ error: 'invalid_body' }, { status: 400 });
  }
  return answered(async () => ({ attachment: await registerAttachment(opened.db, opened.scope, body.data, ATTACHMENT_PORTS) }));
};
