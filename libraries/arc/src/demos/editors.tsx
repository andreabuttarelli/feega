import { FileText, Folder, Settings, Users } from 'lucide-react';
import { RichTextEditor } from '@/components/arc/rich-text-editor/rich-text-editor';
import { SignaturePad } from '@/components/arc/signature-pad/signature-pad';
import { FileDropzone } from '@/components/arc/file-dropzone/file-dropzone';
import { FileUpload } from '@/components/arc/file-upload/file-upload';
import { ExpandingSearch } from '@/components/arc/expanding-search/expanding-search';
import { Cell, Page } from './layout';

const ICON_SIZE = 16;

const SEARCH_ITEMS = [
  { id: 'roadmap', title: 'Q4 roadmap', meta: 'Doc, edited 2h ago', group: 'Documents', icon: <FileText size={ICON_SIZE} /> },
  { id: 'brand', title: 'Brand guidelines', meta: 'Folder, 14 files', group: 'Documents', icon: <Folder size={ICON_SIZE} /> },
  { id: 'team', title: 'Team members', meta: '38 people', group: 'Settings', icon: <Users size={ICON_SIZE} /> },
  { id: 'billing', title: 'Billing settings', meta: 'Plan and invoices', group: 'Settings', icon: <Settings size={ICON_SIZE} /> }
];

const DROPZONE_ITEMS = [
  { id: 'f1', name: 'northwind-brand-kit.zip', size: 18400000, status: 'uploaded' as const },
  { id: 'f2', name: 'pricing-page-v3.fig', size: 9200000, status: 'uploaded' as const },
  { id: 'f3', name: 'customer-interviews.csv', size: 412000, status: 'failed' as const, error: 'Upload interrupted', retryable: true }
];

const DEFAULT_NOTE = `## Release 4.2 notes

Northwind boards now load **40% faster** on large workspaces.

- Bulk edit up to 500 cards at once
- New CSV and JSON export
- Fixed duplicate notifications on mobile`;

export function EditorsDemo() {
  return (
    <Page columns={2}>
      <Cell title="Rich text editor" span={2}>
        <RichTextEditor aria-label="Release notes" defaultMarkdown={DEFAULT_NOTE} />
      </Cell>

      <Cell title="Signature pad">
        <SignaturePad signer="Maya Chen" hint="Sign above to accept the Northwind master services agreement" label="Signature" />
      </Cell>

      <Cell title="File dropzone">
        <FileDropzone
          label="Project files"
          description="PNG, PDF, FIG or ZIP up to 50 MB."
          multiple
          defaultItems={DROPZONE_ITEMS}
          listPlacement="below"
        />
      </Cell>

      <Cell title="File upload">
        <FileUpload label="Company logo" description="SVG or PNG, at least 512 by 512 pixels." accept="image/png,image/svg+xml" />
      </Cell>

      <Cell title="Expanding search">
        <ExpandingSearch label="Search workspace" items={SEARCH_ITEMS} suggestions={SEARCH_ITEMS.slice(0, 2)} suggestionsLabel="Recent" placeholder="Search docs, people, settings" anchor="start" />
      </Cell>
    </Page>
  );
}
