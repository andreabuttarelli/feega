import {
  Archive,
  Bold,
  Bookmark,
  Download,
  Flame,
  Heart,
  Italic,
  Laptop,
  Link2,
  Mail,
  PartyPopper,
  Pencil,
  Plus,
  Share2,
  Sparkles,
  Star,
  ThumbsUp,
  Trash2,
  Underline,
  Zap
} from 'lucide-react';
import { Button } from '@/components/arc/button/button';
import { ActionSwap } from '@/components/arc/action-swap/action-swap';
import { ActionButton } from '@/components/arc/action-button/action-button';
import { SplitButton } from '@/components/arc/split-button/split-button';
import { ButtonGroup } from '@/components/arc/button-group/button-group';
import { FloatingButtonGroup } from '@/components/arc/floating-button-group/floating-button-group';
import { ExpandingButtonGroup } from '@/components/arc/expanding-button-group/expanding-button-group';
import { CopyButton } from '@/components/arc/copy-button/copy-button';
import { ThemeSwitch } from '@/components/arc/theme-switch/theme-switch';
import { HoldToConfirm } from '@/components/arc/hold-to-confirm/hold-to-confirm';
import { Reactions } from '@/components/arc/reactions/reactions';
import { SwipeActions, SwipeActionsRow } from '@/components/arc/swipe-actions/swipe-actions';
import { IconMorph } from '@/components/arc/icon-morph/icon-morph';
import { ConfirmMorph } from '@/components/arc/confirm-morph/confirm-morph';
import { Cell, Page, Row, Stack } from './layout';

const noop = () => {};
const ICON_SIZE = 16;

const FOLLOW_STATES = [
  { id: 'follow', label: 'Follow project', icon: <Plus size={ICON_SIZE} />, tone: 'accent' as const },
  { id: 'following', label: 'Following', icon: <Star size={ICON_SIZE} />, tone: 'quiet' as const }
];

const REACTION_OPTIONS = [
  { id: 'like', label: 'Like', icon: ThumbsUp },
  { id: 'love', label: 'Love', icon: Heart },
  { id: 'party', label: 'Celebrate', icon: PartyPopper },
  { id: 'fire', label: 'Fire', icon: Flame }
];

const REACTION_VALUE = [
  { id: 'like', count: 24, reacted: true },
  { id: 'love', count: 11, reacted: false },
  { id: 'party', count: 6, reacted: false },
  { id: 'fire', count: 3, reacted: false }
];

export function ButtonsDemo() {
  return (
    <Page columns={3}>
      <Cell title="Button">
        <Row>
          <Button variant="primary">Start free trial</Button>
          <Button variant="secondary">Book a demo</Button>
        </Row>
        <Row>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Delete workspace</Button>
          <Button variant="primary" size="sm">Invite</Button>
          <Button variant="secondary" size="lg" loading>Saving</Button>
        </Row>
      </Cell>

      <Cell title="Action swap">
        <Row>
          <ActionSwap states={FOLLOW_STATES} defaultValue="follow" />
          <ActionSwap states={FOLLOW_STATES} defaultValue="following" size="sm" />
        </Row>
      </Cell>

      <Cell title="Action button">
        <Row>
          <ActionButton label="Export invoices" successLabel="Exported 128 invoices" pendingLabel="Exporting" onAction={noop} />
        </Row>
      </Cell>

      <Cell title="Split button">
        <Row>
          <SplitButton
            label="Publish release"
            icon={<Zap size={ICON_SIZE} />}
            actions={[
              { label: 'Schedule for Monday, 9:00', icon: <Mail size={ICON_SIZE} /> },
              { label: 'Save as draft', icon: <Pencil size={ICON_SIZE} /> },
              { label: 'Discard changes', icon: <Trash2 size={ICON_SIZE} />, destructive: true }
            ]}
          />
          <SplitButton variant="secondary" label="Share" actions={[{ label: 'Copy link' }, { label: 'Invite by email' }]} />
        </Row>
      </Cell>

      <Cell title="Button group">
        <Stack>
          <ButtonGroup
            label="Text formatting"
            items={[
              { id: 'bold', label: 'Bold', icon: <Bold size={ICON_SIZE} />, iconOnly: true },
              { id: 'italic', label: 'Italic', icon: <Italic size={ICON_SIZE} />, iconOnly: true },
              { id: 'underline', label: 'Underline', icon: <Underline size={ICON_SIZE} />, iconOnly: true }
            ]}
          />
          <ButtonGroup
            label="Review actions"
            variant="solid"
            items={[
              { id: 'approve', label: 'Approve' },
              { id: 'request', label: 'Request changes' }
            ]}
            menu={{
              label: 'More review actions',
              items: [
                { id: 'assign', label: 'Reassign reviewer' },
                { id: 'close', label: 'Close pull request', destructive: true }
              ]
            }}
          />
        </Stack>
      </Cell>

      <Cell title="Floating button group">
        <Stack>
          <FloatingButtonGroup
            label="Canvas tools"
            variant="floating"
            iconOnly
            items={[
              { id: 'share', label: 'Share', icon: <Share2 size={ICON_SIZE} /> },
              { id: 'bookmark', label: 'Bookmark', icon: <Bookmark size={ICON_SIZE} />, pressed: true },
              { type: 'separator', id: 'divider' },
              { id: 'download', label: 'Download', icon: <Download size={ICON_SIZE} />, shortcut: 'D' }
            ]}
          />
          <FloatingButtonGroup
            label="Document actions"
            variant="muted"
            items={[
              { id: 'edit', label: 'Edit', icon: <Pencil size={ICON_SIZE} /> },
              { id: 'archive', label: 'Archive', icon: <Archive size={ICON_SIZE} /> }
            ]}
          />
        </Stack>
      </Cell>

      <Cell title="Expanding button group">
        <ExpandingButtonGroup
          label="Task actions"
          defaultExpanded="copy"
          items={[
            { id: 'copy', label: 'Copy link', icon: <Link2 size={ICON_SIZE} />, doneLabel: 'Copied' },
            { id: 'email', label: 'Email', icon: <Mail size={ICON_SIZE} /> },
            { id: 'delete', label: 'Delete', icon: <Trash2 size={ICON_SIZE} />, tone: 'danger' }
          ]}
        />
      </Cell>

      <Cell title="Copy button">
        <Row>
          <CopyButton value="sk_live_northwind_4f9a2c" label="Copy API key" />
          <CopyButton value="northwind.app/invite/ana" iconOnly />
          <CopyButton value="npm install @northwind/sdk" variant="plain" label="Copy command" />
        </Row>
      </Cell>

      <Cell title="Theme switch">
        <Row>
          <ThemeSwitch theme="light" variant="reveal" onThemeChange={noop} label="Reveal" />
          <ThemeSwitch theme="light" variant="eclipse" onThemeChange={noop} label="Eclipse" />
          <ThemeSwitch theme="light" variant="split" onThemeChange={noop} label="Split" />
          <ThemeSwitch theme="dark" variant="rise" onThemeChange={noop} label="Rise" />
        </Row>
      </Cell>

      <Cell title="Hold to confirm">
        <Row>
          <HoldToConfirm label="Hold to delete project" tone="danger" icon={<Trash2 size={ICON_SIZE} />} onConfirm={noop} />
          <HoldToConfirm label="Hold to deploy" tone="accent" icon={<Zap size={ICON_SIZE} />} onConfirm={noop} />
        </Row>
      </Cell>

      <Cell title="Reactions">
        <Reactions label="Reactions to the Q3 roadmap post" options={REACTION_OPTIONS} defaultValue={REACTION_VALUE} />
      </Cell>

      <Cell title="Icon morph">
        <Row gap={20}>
          <IconMorph name="menu" />
          <IconMorph name="play" />
          <IconMorph name="plus" />
          <IconMorph name="copy" />
          <IconMorph name="theme" />
          <IconMorph name="chevron" />
          <IconMorph name="bell" />
          <IconMorph name="heart" state />
        </Row>
      </Cell>

      <Cell title="Confirm morph">
        <Stack>
          <ConfirmMorph label="Remove teammate" icon={<Trash2 size={ICON_SIZE} />} prompt="Remove Priya Nair?" />
          <ConfirmMorph label="Cancel subscription" tone="neutral" icon={<Laptop size={ICON_SIZE} />} />
        </Stack>
      </Cell>

      <Cell title="Swipe actions" span={2}>
        <SwipeActions label="Inbox conversations">
          <SwipeActionsRow
            key="maya"
            label="Maya Chen, Re: Q3 invoice"
            leading={[{ label: 'Pin', icon: <Sparkles size={ICON_SIZE} />, tone: 'accent', onSelect: noop }]}
            trailing={[
              { label: 'Archive', icon: <Archive size={ICON_SIZE} />, tone: 'neutral', onSelect: noop },
              { label: 'Delete', icon: <Trash2 size={ICON_SIZE} />, tone: 'danger', onSelect: noop }
            ]}
          >
            <div style={{ padding: 16 }}>
              <strong>Maya Chen</strong>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Re: Q3 invoice. Attached the corrected PDF with the new PO number.</div>
            </div>
          </SwipeActionsRow>
          <SwipeActionsRow
            key="jonas"
            label="Jonas Weber, Onboarding call"
            trailing={[{ label: 'Archive', icon: <Archive size={ICON_SIZE} />, tone: 'neutral', onSelect: noop }]}
          >
            <div style={{ padding: 16 }}>
              <strong>Jonas Weber</strong>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Onboarding call moved to Thursday 14:30 CET.</div>
            </div>
          </SwipeActionsRow>
        </SwipeActions>
      </Cell>
    </Page>
  );
}
