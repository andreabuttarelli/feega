import { Sparkles } from 'lucide-react';
import { ImageCompare } from '@/components/arc/image-compare/image-compare';
import { Carousel } from '@/components/arc/carousel/carousel';
import { CardStack } from '@/components/arc/card-stack/card-stack';
import { CodeBlock } from '@/components/arc/code-block/code-block';
import { JsonViewer } from '@/components/arc/json-viewer/json-viewer';
import { artwork, Cell, Page } from './layout';

const SWIPE_DECK = [
  { id: 'c1', name: 'Acme Logistics', plan: 'Enterprise', arr: '$86,000' },
  { id: 'c2', name: 'Bluebird Studio', plan: 'Team', arr: '$14,400' },
  { id: 'c3', name: 'Cobalt Health', plan: 'Scale', arr: '$41,200' }
];

const SNIPPET = `import { Northwind } from '@northwind/sdk';

const client = new Northwind({ apiKey: process.env.NORTHWIND_KEY });

const board = await client.boards.create({
  name: 'Q4 launch plan',
  members: ['maya@northwind.app'],
});

console.log(board.url);`;

const ACCOUNT_JSON = {
  id: 'acct_8f2a91',
  name: 'Acme Logistics',
  plan: { tier: 'enterprise', seats: 120, annual: true },
  owner: { name: 'Maya Chen', email: 'maya.chen@acme.example' },
  features: ['sso', 'audit-log', 'api-v3'],
  trialEndsAt: null,
  mrr: 7166.67
};

const slide = (index: number, label: string) => (
  <img src={artwork(index, label)} alt={label} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 12, display: 'block' }} />
);

const frame = (index: number, label: string) => (
  <img src={artwork(index, label)} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
);

export function DataMediaDemo() {
  return (
    <Page columns={3}>
      <Cell title="Image compare" span={2}>
        <div style={{ height: 260 }}>
          <ImageCompare before={frame(2, 'Before')} after={frame(3, 'After')} defaultPosition={55} label="Homepage hero before and after" aspectRatio="16 / 6" />
        </div>
      </Cell>

      <Cell title="Carousel">
        <Carousel label="Customer stories" slideLabel={(index, count) => `Story ${index + 1} of ${count}`}>
          {slide(0, 'Acme Logistics')}
          {slide(1, 'Bluebird Studio')}
          {slide(2, 'Cobalt Health')}
        </Carousel>
      </Cell>

      <Cell title="Card stack">
        <CardStack
          label="Renewal review"
          items={SWIPE_DECK}
          getKey={(item) => item.id}
          getLabel={(item) => item.name}
          labels={{ left: 'Skip', right: 'Prioritise' }}
          renderCard={(item) => (
            <div style={{ padding: 24 }}>
              <Sparkles size={18} />
              <strong style={{ display: 'block', marginTop: 12 }}>{item.name}</strong>
              <div style={{ color: 'var(--text-secondary)' }}>{item.plan} plan, {item.arr} ARR</div>
            </div>
          )}
        />
      </Cell>

      <Cell title="Code block" span={2}>
        <CodeBlock code={SNIPPET} filename="create-board.ts" language="ts" />
      </Cell>

      <Cell title="JSON viewer">
        <JsonViewer data={ACCOUNT_JSON} rootName="account" defaultExpandDepth={2} label="Account payload" />
      </Cell>
    </Page>
  );
}
