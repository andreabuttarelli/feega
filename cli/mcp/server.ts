import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { asTool } from '../lib/api.ts';
import { getRequestAuth } from './context.ts';
import { mcpLog } from './observability.ts';
import { registerOrgDataTools } from './tools/org-data.ts';
import { registerPostTools } from './tools/posts.ts';
import { registerAdsTools } from './tools/ads.ts';
import { registerNodeTools } from './tools/nodes.ts';
import { registerPromptTools } from './tools/prompts.ts';
import { registerMotionTools } from './tools/motion.ts';
import { registerGalleryTools } from './tools/gallery.ts';
import { registerLayoutTools } from './tools/layouts.ts';
import { SocialPublishing } from './features.ts';

/**
 * Il client la mostra da solo al handshake, una volta per sessione, PRIMA di ogni descrizione e
 * prima della skill. Quindi è la mappa del server — come è organizzato, cosa serve un brand,
 * cosa costa — non la ripetizione dei tool, che si leggono da soli poco dopo.
 *
 * `Always start with list_brands` stava qui, ed è stato eseguito alla lettera: l'agente lo
 * chiamava per qualunque cosa e poi sceglieva un brand a caso, spendendo i crediti di
 * un'organizzazione vera e scrivendo nella libreria di un cliente vero.
 */
const POSTS_INSTRUCTION =
  'A canvas node is raw material; a post (`list_posts`/`create_post`/`set_post_status`) is the promoted artifact ready to schedule.';

const ADS_INSTRUCTION =
  'An ad campaign (`list_ad_campaigns`/`create_ad_campaign`/`approve_ad_campaign`/`set_ad_campaign_status`) always drafts unapproved; only a signed-in person approves it.';

const INSTRUCTIONS_OF: Record<SocialPublishing, string> = {
  [SocialPublishing.On]: `${POSTS_INSTRUCTION} ${ADS_INSTRUCTION}`,
  [SocialPublishing.Off]: ADS_INSTRUCTION,
};

export function mcpInstructions(publishing: SocialPublishing): string {
  return MCP_INSTRUCTION_LINES(INSTRUCTIONS_OF[publishing]).join(' ');
}

const MCP_INSTRUCTION_LINES = (promoted: string) => [
  'feega is an infinite canvas of typed nodes (media, social feeds, products, ads, generations), driven by a person, the in-app chat, or an agent here over MCP.',
  'Reads cost nothing and change nothing, and READING IS ONE TOOL: `query`. Every table, scoped to your org. Name `columns` or the answer comes back short; `offset` is the next page; `count: "exact"` when the number IS the answer; `embed` brings a related table along.',
  'Three generic writes reach every table: `insert_row`, `update_row`, `delete_row`. `describe_node_types` gives the JSON Schema `nodes.data` must match per `type` before you insert or update one.',
  '`run_node_generation` is the canvas Generate button: fills an existing node, never creates one; omit `model` for the default; `medium` must match the node\'s type; a video comes back `queued`. `apply_effects`/`make_effects_pair` render effects (`list_effects`; custom: `write_effect`, `patch_effect`), free. `enhance_prompt` improves a prompt. `run_node_loop` queues every combination of a node\'s inputs (`preview_node_loop` free, `cancel_node_loop` stops what\'s queued); confirm >50, refused >1000.',
  promoted,
  'A project needs no brand (`projects.brand_id` is nullable, and that is the normal case): attach one only to publish.',
  '`get_media` shows what a node, run or asset holds: fetch `preview_url` to look, give `full_url` to the user.',
  '`list_motion_videos` finds `motion` nodes; `ask_motion_agent` edits one (`get_motion_run`, `get_motion_summary`); `render_video`, `get_render`; `publish_motion_embed`, `get_motion_embed`; `view_motion_frames` shows frames of one; `search_gallery`, `remix_gallery_item`, `publish_to_gallery`; layouts: `write_layout`, `patch_layout`, `list_layouts`.',
  'Signing in is not a tool: over HTTP the host sends the Bearer; locally run `feega login` once (shared session file).'
];

export const MCP_INSTRUCTIONS = mcpInstructions(SocialPublishing.Off);

type ListedTool = { inputSchema?: Record<string, unknown> };

function withoutKeysNoClientReads(result: unknown): unknown {
  const { tools } = result as { tools: ListedTool[] };

  return {
    tools: tools.map(({ inputSchema, ...tool }) => {
      const { $schema, ...schema } = inputSchema ?? {};
      return { ...tool, execution: undefined, inputSchema: schema };
    }),
  };
}

/**
 * L'SDK aggiunge a ogni tool due chiavi che nessun client legge, e le paghiamo a ogni sessione:
 * `$schema` dichiara il dialetto di uno schema che il protocollo dichiara già JSON Schema, e
 * `execution.taskSupport: 'forbidden'` è esattamente ciò che l'assenza del campo significa.
 * Erano 10.948 caratteri, l'8,5% di `tools/list`.
 *
 * Si decora l'unico punto in cui l'SDK installa il suo handler, prima che i tool lo creino.
 */
function trimListedTools(server: McpServer): void {
  const inner = server.server;
  const install = inner.setRequestHandler.bind(inner);

  inner.setRequestHandler = ((schema: unknown, handler: (...args: unknown[]) => unknown) => {
    if (schema !== ListToolsRequestSchema) return install(schema as never, handler as never);

    return install(schema as never, (async (...args: unknown[]) =>
      withoutKeysNoClientReads(await handler(...args))) as never);
  }) as typeof inner.setRequestHandler;
}

type ToolHandler = (...args: unknown[]) => unknown;

function brandSlugOf(args: unknown[]): string | undefined {
  const input = args[0] as { slug?: unknown } | undefined;
  return typeof input?.slug === 'string' ? input.slug : undefined;
}

/**
 * LE TRE COLONNE CHE ARRIVAVANO SEMPRE VUOTE. `observability.ts` scrive `tool_name`, `user_id` e
 * `brand_slug` da sempre, e nessuno in `cli/mcp/` le passava. Il posto dove riempirle è uno solo —
 * dove un tool viene eseguito — quindi è un lavoro solo, non tre. Senza, di una richiesta finita
 * 401 non si sa dire se sia un cliente che non riesce a collegarsi o qualcuno che sta provando, e
 * quelle due vogliono risposte opposte.
 *
 * `user_id` è l'IDENTIFICATORE e si ferma lì: l'identità arriva qui con l'email accanto, e la
 * tabella la leggerà chi non ha motivo di vedere l'indirizzo di un cliente.
 *
 * Si decora `registerTool` una volta sola, prima che i quattro moduli registrino: un tool nuovo è
 * strumentato per il fatto di esistere, e la riga non dipende da chi si ricorda di scriverla.
 * Niente qui può rovesciare la chiamata che sta descrivendo: `mcpLog` non torna mai un guasto a
 * chi lo chiama, e i due campi letti dalla richiesta sono letture e basta.
 *
 * Lo stesso scope porta il nome fino alle chiamate HTTP che il tool fa (`asTool`), dove diventa
 * l'intestazione che lega la spesa in `ai_calls` al tool che l'ha causata.
 */
function recordToolCalls(server: McpServer): void {
  const register = server.registerTool.bind(server);

  server.registerTool = ((name: string, config: unknown, handler: ToolHandler) =>
    register(name as never, config as never, (async (...args: unknown[]) => {
      const started = Date.now();
      const common = {
        event: 'tool.call',
        toolName: name,
        brandSlug: brandSlugOf(args),
        userId: getRequestAuth()?.user.id,
      } as const;

      try {
        const result = (await asTool(name, () => handler(...args))) as { isError?: boolean };
        const failed = result?.isError === true;

        mcpLog({
          ...common,
          level: failed ? 'warn' : 'info',
          message: failed ? `${name} returned an error` : name,
          durationMs: Date.now() - started,
        });

        return result;
      } catch (e) {
        mcpLog({
          ...common,
          level: 'error',
          message: e instanceof Error ? e.message : String(e),
          durationMs: Date.now() - started,
          error: e,
        });
        throw e;
      }
    }) as never)) as typeof server.registerTool;
}

const PUBLISHING_TOOLS: Record<SocialPublishing, (server: McpServer) => void> = {
  [SocialPublishing.On]: registerPostTools,
  [SocialPublishing.Off]: () => {},
};

export function createFeegaMcpServer(publishing: SocialPublishing): McpServer {
  const server = new McpServer(
    {
      name: 'feega',
      version: '0.1.0',
      description:
        'feega infinite canvas — query and write projects, canvases, nodes, motion videos and ad campaigns via OAuth.',
    },
    { instructions: mcpInstructions(publishing) },
  );

  trimListedTools(server);
  recordToolCalls(server);

  registerOrgDataTools(server);
  PUBLISHING_TOOLS[publishing](server);
  registerAdsTools(server);
  registerNodeTools(server);
  registerPromptTools(server);
  registerMotionTools(server);
  registerGalleryTools(server);
  registerLayoutTools(server);

  return server;
}
