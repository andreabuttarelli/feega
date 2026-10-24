import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createClient } from '@supabase/supabase-js';
import { EXCLUDED_FEEGA_TOOLS, REPO_ROOT, TEST_ACCOUNT_EMAIL } from './config';
import type { Image, ToolOutput, ToolSpec, Tools } from './agent-loop';

export enum ToolListing {
  Static = 'static',
  Dynamic = 'dynamic'
}

const APP_URL = 'https://oh.feega.app';
const SUPABASE_URL = 'https://klnswzhhgrqvbfjzioul.supabase.co';

type Session = { access_token: string; refresh_token: string; expires_at: number; user: { id: string; email: string } };

export type FeegaMcp = { tools: Tools; callJson: (name: string, args: Record<string, unknown>) => Promise<unknown>; close: () => Promise<void>; toolCount: number; instructions: string };

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export async function mintTestSession(): Promise<Session> {
  const admin = createClient(SUPABASE_URL, required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: TEST_ACCOUNT_EMAIL });
  const hashed = link.data?.properties?.hashed_token;
  if (!hashed) {
    throw new Error(`no magic link for ${TEST_ACCOUNT_EMAIL}: ${link.error?.message}`);
  }

  const anon = createClient(SUPABASE_URL, required('PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false } });
  const verified = await anon.auth.verifyOtp({ token_hash: hashed, type: 'magiclink' });
  const s = verified.data.session;
  if (!s || s.user.email !== TEST_ACCOUNT_EMAIL) {
    throw new Error(`session for ${TEST_ACCOUNT_EMAIL} failed: ${verified.error?.message}`);
  }
  return { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at ?? 0, user: { id: s.user.id, email: s.user.email } };
}

function textOf(result: { content?: unknown; isError?: boolean }): ToolOutput {
  const parts = (result.content ?? []) as { type: string; text?: string; data?: string; mimeType?: string }[];
  const text = parts.filter((p) => p.type === 'text').map((p) => p.text ?? '').join('\n');
  const images: Image[] = parts.filter((p) => p.type === 'image').map((p) => ({ mime: p.mimeType ?? 'image/jpeg', data: p.data ?? '' }));
  return { text: result.isError ? `error: ${text}` : text, images };
}

export async function connectFeega(session: Session, listing: ToolListing = ToolListing.Static): Promise<FeegaMcp> {
  const home = mkdtempSync(join(tmpdir(), 'feega-eval-home-'));
  mkdirSync(join(home, '.config', 'feega'), { recursive: true });
  writeFileSync(join(home, '.config', 'feega', 'session.json'), JSON.stringify(session));

  const transport = new StdioClientTransport({
    command: 'bun',
    args: ['run', join(REPO_ROOT, 'cli', 'mcp', 'stdio.ts')],
    env: { PATH: process.env.PATH ?? '', HOME: home, PUBLIC_APP_URL: APP_URL },
    stderr: 'ignore'
  });
  const client = new Client({ name: 'external-agent-eval', version: '1.0.0' });
  await client.connect(transport);

  const specs: ToolSpec[] = [];
  const refresh = async () => {
    const listed = await client.listTools();
    const kept = listed.tools.filter((t) => !EXCLUDED_FEEGA_TOOLS.has(t.name)).map((t) => ({ name: t.name, description: t.description ?? '', parameters: t.inputSchema as Record<string, unknown> }));
    specs.splice(0, specs.length, ...kept);
  };
  await refresh();
  if (listing === ToolListing.Dynamic) {
    client.setNotificationHandler(ToolListChangedNotificationSchema, refresh);
  }

  const call = async (name: string, args: Record<string, unknown>) => textOf((await client.callTool({ name, arguments: args })) as never);

  return {
    toolCount: specs.length,
    instructions: client.getInstructions() ?? '',
    tools: { specs, call },
    callJson: async (name, args) => {
      const out = await call(name, args);
      if (out.text.startsWith('error')) {
        throw new Error(`${name}: ${out.text.slice(0, 400)}`);
      }
      return JSON.parse(out.text);
    },
    close: () => client.close()
  };
}
