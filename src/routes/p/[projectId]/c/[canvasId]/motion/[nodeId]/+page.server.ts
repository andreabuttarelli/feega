import { fail, type Action } from '@sveltejs/kit';
import type { Actions } from './$types';
import { motionScope as scopeFor, type MotionEditorScope } from '$lib/server/motion/editor-scope';
import { isEditorOp, runEditorOp, type EditorAnswer, type EditorCtx } from '$lib/server/frame-editor/editor-ops';
import { gateOrgAiActionForForm } from '$lib/server/cli-auth';
import { savePoster } from '$lib/server/motion/poster';
import { EDITOR_ACTIONS, actionAsk, type EditorActionName } from '$lib/frame-editor/actions';

const HTTP_BAD_REQUEST = 400;

const editorCtx = (scope: MotionEditorScope): EditorCtx => ({
  ...scope,
  actor: { kind: 'user', id: scope.userId },
  gate: async () => {
    const denied = await gateOrgAiActionForForm(scope.orgId);
    return denied ? { status: denied.status, body: denied.data } : null;
  }
});

const answered = (answer: EditorAnswer) => (answer.status >= HTTP_BAD_REQUEST ? fail(answer.status, answer.body) : answer.body);

const viaOp =
  (name: EditorActionName): Action<{ projectId: string; canvasId: string; nodeId: string }> =>
  async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    const asked = actionAsk(name, await request.formData());
    if ('refused' in asked) {
      return fail(asked.refused.status, asked.refused.body);
    }
    if (!isEditorOp(asked.op)) {
      throw new Error(`editor action ${name} names no op: ${asked.op}`);
    }
    return answered(await runEditorOp(asked.op, editorCtx(scope), asked.input as never));
  };

export const actions: Actions = {
  ...(Object.fromEntries(Object.keys(EDITOR_ACTIONS).map((name) => [name, viaOp(name as EditorActionName)])) as Record<EditorActionName, Action>),

  poster: async ({ locals, params, request }) => {
    const scope = await scopeFor(locals, params);
    return savePoster(scope.db, { orgId: scope.orgId, projectId: params.projectId, nodeId: scope.motion.record.id, actor: { kind: 'user', id: scope.userId }, form: await request.formData() });
  }
};
