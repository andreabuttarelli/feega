import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const OUT = fileURLToPath(new URL('../data/model-prices.snapshot.json', import.meta.url));
const KIE_PRICING_URL = 'https://api.kie.ai/client/v1/model-pricing/page';
const KIE_PAGE_SIZE = 100;
const MODELS_PAGE_SIZE = 1000;
const CHAT = 'chat';

const baseUrl = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!baseUrl || !key) {
  console.error('Set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (production). Only SELECT requests are sent.');
  process.exit(1);
}

async function modelRows() {
  const rows = [];
  for (let from = 0; ; from += MODELS_PAGE_SIZE) {
    const url = `${baseUrl}/rest/v1/ai_models?select=id,catalogue,provider,label,pricing&order=id.asc&order=catalogue.asc&limit=${MODELS_PAGE_SIZE}&offset=${from}`;
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) {
      throw new Error(`ai_models: HTTP ${res.status}`);
    }
    const page = await res.json();
    rows.push(...page);
    if (page.length < MODELS_PAGE_SIZE) {
      return rows;
    }
  }
}

const chatPricing = (pricing) => ({ prompt: pricing?.prompt, completion: pricing?.completion });

async function kieRecords() {
  const records = [];
  for (let pageNum = 1, pages = 1; pageNum <= pages; pageNum += 1) {
    const res = await fetch(KIE_PRICING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageNum, pageSize: KIE_PAGE_SIZE })
    });
    const body = await res.json();
    pages = body.data.pages;
    records.push(...body.data.records.map(({ modelDescription, interfaceType, creditPrice, creditUnit }) => ({ modelDescription, interfaceType, creditPrice, creditUnit })));
  }
  return records;
}

const rows = (await modelRows()).map((row) => ({ ...row, pricing: row.catalogue === CHAT ? chatPricing(row.pricing) : row.pricing }));
const snapshot = { takenAt: new Date().toISOString().slice(0, 10), rows, kie: await kieRecords() };

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(snapshot)}\n`);
console.log(`${rows.length} ai_models rows, ${snapshot.kie.length} Kie price records, ${snapshot.takenAt}`);
