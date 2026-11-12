import { Flag, Tag, User } from 'lucide-react';
import { Accordion } from '@/components/arc/accordion/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/arc/tabs/tabs';
import { Breadcrumb } from '@/components/arc/breadcrumb/breadcrumb';
import { Pagination } from '@/components/arc/pagination/pagination';
import { ExpandableCard } from '@/components/arc/expandable-card/expandable-card';
import { ExpandableText } from '@/components/arc/expandable-text/expandable-text';
import { ResizablePanel, ResizablePanels } from '@/components/arc/resizable-panels/resizable-panels';
import { ScrollArea } from '@/components/arc/scroll-area/scroll-area';
import { FilterToolbar } from '@/components/arc/filter-toolbar/filter-toolbar';
import { Cell, Page, Stack } from './layout';

const noop = () => {};
const ICON_SIZE = 14;

const FAQ_ITEMS = [
  { title: 'Can I change plans later?', content: 'Yes. Upgrades apply immediately and downgrades take effect at the end of your billing cycle.' },
  { title: 'Do you offer annual billing?', content: 'Annual plans are billed upfront and include two months free compared to monthly billing.' },
  { title: 'Where is my data stored?', content: 'Workspaces are hosted in the region you pick at signup, with daily encrypted backups.' }
];

const ACTIVITY = [
  'Maya Chen merged pull request #482',
  'Tomas Ferreira commented on NW-317',
  'Lena Okafor moved Pricing page to Review',
  'Deploy 4.2.1 finished in 3m 12s',
  'Priya Nair uploaded checkout-v3.fig',
  'Jonas Weber closed 6 stale issues',
  'Ana Souza invited 3 new members',
  'Nightly backup completed, 12.4 GB'
];

const FILTERS = [
  { id: 'status', label: 'Status', value: 'In progress' },
  { id: 'owner', label: 'Owner', value: 'Maya Chen' }
];

const FILTER_FIELDS = [
  { id: 'status', label: 'Status', icon: <Flag size={ICON_SIZE} />, options: ['Backlog', 'In progress', 'Done'] },
  { id: 'owner', label: 'Owner', icon: <User size={ICON_SIZE} />, options: ['Maya Chen', 'Tomas Ferreira', 'Lena Okafor'] },
  { id: 'label', label: 'Label', icon: <Tag size={ICON_SIZE} />, options: ['Bug', 'Feature', 'Design'] }
];

export function NavigationDemo() {
  return (
    <Page columns={3}>
      <Cell title="Breadcrumb" span={3}>
        <Breadcrumb
          items={[
            { label: 'Northwind', href: '#' },
            { label: 'Projects', href: '#' },
            { label: 'Mobile redesign', href: '#' },
            { label: 'Checkout flow' }
          ]}
        />
      </Cell>

      <Cell title="Tabs" span={2}>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Northwind Mobile ships on November 19. 42 of 57 tasks are complete.</TabsContent>
          <TabsContent value="activity">Recent activity appears here.</TabsContent>
          <TabsContent value="members">Members appear here.</TabsContent>
        </Tabs>
      </Cell>

      <Cell title="Pagination">
        <Pagination page={4} pageCount={12} onPageChange={noop} label="Invoices pages" />
      </Cell>

      <Cell title="Accordion" span={2}>
        <Accordion items={FAQ_ITEMS} defaultOpen={0} />
      </Cell>

      <Cell title="Expandable text">
        <ExpandableText lines={3}>
          Northwind brings planning, docs and reporting into one workspace. Teams use it to run product roadmaps, track customer feedback, and keep every stakeholder aligned without another status meeting. Boards sync in real time, and every change is recorded in a searchable history.
        </ExpandableText>
      </Cell>

      <Cell title="Expandable card">
        <ExpandableCard title="Q4 launch checklist" description="9 of 12 items done">
          <Stack gap={4}>
            <span>Finalize pricing page copy</span>
            <span>QA the iOS release build</span>
            <span>Schedule the customer webinar</span>
          </Stack>
        </ExpandableCard>
      </Cell>

      <Cell title="Scroll area">
        <ScrollArea maxHeight={180} label="Recent activity" scrollbars="always">
          <Stack gap={10}>
            {ACTIVITY.map((entry) => (
              <div key={entry} style={{ fontSize: 14 }}>{entry}</div>
            ))}
          </Stack>
        </ScrollArea>
      </Cell>

      <Cell title="Filter toolbar">
        <FilterToolbar
          filters={FILTERS}
          onRemove={noop}
          onClearAll={noop}
          addFilter={{ fields: FILTER_FIELDS, onAdd: noop }}
          label="Filter tasks"
        />
      </Cell>

      <Cell title="Resizable panels" span={3}>
        <div style={{ height: 220, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <ResizablePanels label="Editor layout">
            <ResizablePanel id="files" label="Files" defaultSize={25} minSize={15}>
              <div style={{ padding: 16 }}>src/<br />docs/<br />README.md</div>
            </ResizablePanel>
            <ResizablePanel id="editor" label="Editor" defaultSize={50} minSize={30}>
              <div style={{ padding: 16 }}>export function Checkout() {'{'} ... {'}'}</div>
            </ResizablePanel>
            <ResizablePanel id="preview" label="Preview" defaultSize={25} minSize={15}>
              <div style={{ padding: 16 }}>Live preview</div>
            </ResizablePanel>
          </ResizablePanels>
        </div>
      </Cell>
    </Page>
  );
}
