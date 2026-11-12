import { FileText, Folder, FolderOpen, Rocket, Wrench } from 'lucide-react';
import { SortableDataTable } from '@/components/arc/sortable-data-table/sortable-data-table';
import { TreeView } from '@/components/arc/tree-view/tree-view';
import { TreeTable } from '@/components/arc/tree-table/tree-table';
import { Timeline } from '@/components/arc/timeline/timeline';
import { ChatThread } from '@/components/arc/chat-thread/chat-thread';
import { CommentThread } from '@/components/arc/comment-thread/comment-thread';
import { Badge } from '@/components/arc/badge/badge';
import { artwork, Cell, Page } from './layout';

const ICON_SIZE = 16;
const NOW = Date.UTC(2026, 10, 12, 10, 0, 0);
const MINUTE_MS = 60000;
const HOUR_MS = 3600000;

type Invoice = { id: string; customer: string; amount: number; status: string; due: string };

const INVOICES: Invoice[] = [
  { id: 'INV-2051', customer: 'Acme Logistics', amount: 4800, status: 'Paid', due: 'Nov 8' },
  { id: 'INV-2052', customer: 'Bluebird Studio', amount: 1200, status: 'Open', due: 'Nov 20' },
  { id: 'INV-2053', customer: 'Cobalt Health', amount: 9650, status: 'Overdue', due: 'Oct 30' },
  { id: 'INV-2054', customer: 'Delta Freight', amount: 2310, status: 'Paid', due: 'Nov 11' },
  { id: 'INV-2055', customer: 'Evergreen Foods', amount: 760, status: 'Open', due: 'Nov 28' }
];

const STATUS_TONE: Record<string, 'success' | 'info' | 'danger'> = { Paid: 'success', Open: 'info', Overdue: 'danger' };

const FILE_TREE = [
  {
    id: 'src',
    label: 'src',
    icon: <FolderOpen size={ICON_SIZE} />,
    children: [
      { id: 'app', label: 'app', icon: <Folder size={ICON_SIZE} />, children: [{ id: 'page', label: 'page.tsx', icon: <FileText size={ICON_SIZE} /> }, { id: 'layout', label: 'layout.tsx', icon: <FileText size={ICON_SIZE} /> }] },
      { id: 'lib', label: 'lib', icon: <Folder size={ICON_SIZE} />, children: [{ id: 'api', label: 'api.ts', icon: <FileText size={ICON_SIZE} /> }] },
      { id: 'index', label: 'index.ts', icon: <FileText size={ICON_SIZE} /> }
    ]
  },
  { id: 'pkg', label: 'package.json', icon: <FileText size={ICON_SIZE} /> },
  { id: 'readme', label: 'README.md', icon: <FileText size={ICON_SIZE} /> }
];

type Task = { name: string; owner: string; progress: string };

const TASK_ROWS = [
  {
    id: 'launch',
    data: { name: 'Q4 launch', owner: 'Maya Chen', progress: '71%' },
    children: [
      { id: 'pricing', data: { name: 'Pricing page', owner: 'Lena Okafor', progress: '100%' } },
      { id: 'webinar', data: { name: 'Customer webinar', owner: 'Priya Nair', progress: '40%' } }
    ]
  },
  {
    id: 'platform',
    data: { name: 'Platform reliability', owner: 'Tomas Ferreira', progress: '55%' },
    children: [
      { id: 'queue', data: { name: 'Migrate job queue', owner: 'Tomas Ferreira', progress: '80%' } },
      { id: 'alerts', data: { name: 'Tune alert thresholds', owner: 'Jonas Weber', progress: '30%' } }
    ]
  }
];

const TIMELINE_EVENTS = [
  { id: 't1', at: NOW - 12 * MINUTE_MS, actor: 'Maya Chen', title: 'Merged pull request #482', meta: 'northwind/web', icon: <Rocket size={ICON_SIZE} />, tone: 'success' as const },
  { id: 't2', at: NOW - 2 * HOUR_MS, actor: 'Deploy bot', title: 'Deployed 4.2.1 to production', meta: '3m 12s', icon: <Wrench size={ICON_SIZE} />, tone: 'neutral' as const },
  { id: 't3', at: NOW - 26 * HOUR_MS, actor: 'Tomas Ferreira', title: 'Rolled back 4.2.0', meta: 'Elevated error rate', tone: 'danger' as const }
];

const PARTICIPANTS = [
  { id: 'me', name: 'Maya Chen', avatar: artwork(0) },
  { id: 'lena', name: 'Lena Okafor', avatar: artwork(2) }
];

const CHAT_MESSAGES = [
  { id: 'm1', authorId: 'lena', text: 'Did the invoice export finish for Acme?', createdAt: NOW - 18 * MINUTE_MS },
  { id: 'm2', authorId: 'me', text: 'Yes, 128 invoices exported. Sending the zip now.', createdAt: NOW - 16 * MINUTE_MS, status: 'read' as const },
  { id: 'm3', authorId: 'lena', text: 'Perfect, thank you.', createdAt: NOW - 15 * MINUTE_MS, reactions: [{ emoji: '👍', count: 1 }] }
];

const COMMENTERS = [
  { id: 'priya', name: 'Priya Nair', avatar: artwork(3) },
  { id: 'tomas', name: 'Tomas Ferreira', avatar: artwork(1) }
];

const COMMENTS = [
  {
    id: 'c1',
    author: COMMENTERS[0],
    body: 'Can we try a single-column layout on mobile? The two-column cards feel cramped.',
    createdAt: '2h ago',
    replies: [{ id: 'c2', author: COMMENTERS[1], body: 'Agreed. I will push a prototype today.', createdAt: '1h ago' }]
  }
];

export function DataTablesDemo() {
  return (
    <Page columns={2}>
      <Cell title="Sortable data table" span={2}>
        <SortableDataTable
          caption="Recent invoices"
          rows={INVOICES}
          rowKey="id"
          defaultSort={{ key: 'due', direction: 'asc' }}
          selectable
          itemName={{ one: 'invoice', other: 'invoices' }}
          columns={[
            { key: 'id', label: 'Invoice', sortable: true },
            { key: 'customer', label: 'Customer', sortable: true },
            { key: 'amount', label: 'Amount', sortable: true, numeric: true, render: (value) => `$${Number(value).toLocaleString('en-US')}` },
            { key: 'status', label: 'Status', render: (value) => <Badge tone={STATUS_TONE[String(value)]}>{String(value)}</Badge> },
            { key: 'due', label: 'Due' }
          ]}
        />
      </Cell>

      <Cell title="Tree view">
        <TreeView nodes={FILE_TREE} defaultExpandedIds={['src', 'app']} aria-label="Project files" />
      </Cell>

      <Cell title="Tree table">
        <TreeTable<Task>
          label="Projects and tasks"
          rows={TASK_ROWS}
          defaultExpanded={['launch', 'platform']}
          columns={[
            { id: 'name', header: 'Task', cell: (data) => data.name },
            { id: 'owner', header: 'Owner', cell: (data) => data.owner },
            { id: 'progress', header: 'Done', cell: (data) => data.progress, align: 'end' }
          ]}
        />
      </Cell>

      <Cell title="Timeline">
        <Timeline events={TIMELINE_EVENTS} now={NOW} label="Deploy history" timeZone="UTC" locale="en-US" />
      </Cell>

      <Cell title="Comment thread">
        <CommentThread defaultComments={COMMENTS} currentUser={{ id: 'me', name: 'Maya Chen', avatar: artwork(0) }} people={COMMENTERS} title="Checkout redesign" />
      </Cell>

      <Cell title="Chat thread" span={2}>
        <div style={{ height: 380 }}>
          <ChatThread participants={PARTICIPANTS} currentUserId="me" defaultMessages={CHAT_MESSAGES} label="Billing support chat" />
        </div>
      </Cell>
    </Page>
  );
}
