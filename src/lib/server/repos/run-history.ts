import type { Db } from '$lib/server/db/client';
import type { AssetType } from '$lib/server/repos/assets';

export const RUN_HISTORY_PAGE = 48;

const HISTORY_SELECT =
  'id, model, prompt, cost_usd, created_at, nodes!inner(id, project_id, canvas_id, display_name), assets!node_runs_output_asset_id_fkey!inner(id, type, url, mime_type, content, source)';

export type RunHistoryItem = {
  runId: string;
  model: string | null;
  prompt: string | null;
  costUsd: number | null;
  createdAt: string;
  projectId: string;
  canvasId: string;
  nodeId: string;
  nodeName: string | null;
  asset: { id: string; type: AssetType; url: string | null; mimeType: string | null; content: string | null; source: string | null };
};

export type RunHistoryPage = { items: RunHistoryItem[]; nextBefore: string | null };

type HistoryRow = {
  id: string;
  model: string | null;
  prompt: string | null;
  cost_usd: number | null;
  created_at: string;
  nodes: { id: string; project_id: string; canvas_id: string; display_name: string | null };
  assets: { id: string; type: string; url: string | null; mime_type: string | null; content: string | null; source: string | null };
};

function toItem(row: HistoryRow): RunHistoryItem {
  return {
    runId: row.id,
    model: row.model,
    prompt: row.prompt,
    costUsd: row.cost_usd === null ? null : Number(row.cost_usd),
    createdAt: row.created_at,
    projectId: row.nodes.project_id,
    canvasId: row.nodes.canvas_id,
    nodeId: row.nodes.id,
    nodeName: row.nodes.display_name,
    asset: {
      id: row.assets.id,
      type: row.assets.type as AssetType,
      url: row.assets.url,
      mimeType: row.assets.mime_type,
      content: row.assets.content,
      source: row.assets.source
    }
  };
}

export async function listRunHistory(
  db: Db,
  scope: { orgId: string; model?: string; projectId?: string; before?: string }
): Promise<RunHistoryPage> {
  let query = db.from('node_runs').select(HISTORY_SELECT).eq('org_id', scope.orgId).eq('status', 'done');

  if (scope.model) {
    query = query.eq('model', scope.model);
  }

  if (scope.projectId) {
    query = query.eq('nodes.project_id', scope.projectId);
  }

  if (scope.before) {
    query = query.lt('created_at', scope.before);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(RUN_HISTORY_PAGE + 1);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as HistoryRow[];
  const items = rows.slice(0, RUN_HISTORY_PAGE).map(toItem);
  const hasMore = rows.length > RUN_HISTORY_PAGE;

  return { items, nextBefore: hasMore ? items[items.length - 1].createdAt : null };
}
