import { describe, expect, test } from 'bun:test';
import { handleMcpFetch } from './http-app.ts';

const RETIRED_TOOLS = [
  'list_ad_campaigns',
  'create_ad_campaign',
  'approve_ad_campaign',
  'set_ad_campaign_status',
  'list_posts',
  'create_post',
  'approve_post',
  'publish_post',
  'schedule_post',
  'reschedule_post',
  'get_calendar',
  'connect_social_account',
  'set_automation',
  'run_routine',
];

const RETIRED_FEATURE_NAME = /ad_campaign|(^|_)posts?(_|$)|schedul|calendar|autopilot|routine|social_account/;

async function post(body: unknown) {
  return handleMcpFetch(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify(body),
    }),
  );
}

async function listedNames(): Promise<string[]> {
  await post({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0.0.1' } },
  });
  const res = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const body = (await res.json()) as { result: { tools: { name: string }[] } };

  return body.result.tools.map((tool) => tool.name);
}

describe('i tool dei prodotti usciti non tornano', () => {
  test('tools/list non contiene nessun tool ritirato', async () => {
    const names = await listedNames();

    expect(names.filter((name) => RETIRED_TOOLS.includes(name))).toEqual([]);
  });

  test('nessun nome di tool richiama ads, post, calendario, autopilot o routine', async () => {
    const names = await listedNames();

    expect(names.filter((name) => RETIRED_FEATURE_NAME.test(name))).toEqual([]);
  });
});
