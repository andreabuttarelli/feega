import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/arc/dialog/dialog';
import { Button } from '@/components/arc/button/button';
import { Input } from '@/components/arc/input/input';
import { Cell, Page, Row, Stack } from './layout';

const PAGE_MIN_HEIGHT = 720;

export function OverlayDialogDemo() {
  return (
    <Page columns={1}>
      <Cell title="Dialog" minHeight={PAGE_MIN_HEIGHT}>
        <Dialog defaultOpen>
          <DialogTrigger asChild>
            <Button variant="secondary">Invite teammate</Button>
          </DialogTrigger>
          <DialogContent title="Invite a teammate" description="They will get an email with a link to join the Northwind workspace.">
            <Stack gap={16}>
              <Input label="Email address" type="email" defaultValue="lena.okafor@northwind.app" />
              <Row>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button variant="primary">Send invite</Button>
              </Row>
            </Stack>
          </DialogContent>
        </Dialog>
      </Cell>
    </Page>
  );
}
