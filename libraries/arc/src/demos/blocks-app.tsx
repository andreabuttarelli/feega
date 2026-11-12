import { PlanComparison } from '@/components/arc/blocks/plan-comparison/plan-comparison';
import { PageHeader } from '@/components/arc/blocks/page-header/page-header';
import { EmptyStates } from '@/components/arc/blocks/empty-states/empty-states';
import { Cell, Page } from './layout';

export function BlocksAppDemo() {
  return (
    <Page columns={1}>
      <Cell title="Plan comparison">
        <PlanComparison />
      </Cell>

      <Cell title="Page header">
        <PageHeader />
      </Cell>

      <Cell title="Empty states">
        <EmptyStates />
      </Cell>
    </Page>
  );
}
