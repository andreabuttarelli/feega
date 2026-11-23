import { reader } from '@feega/live-edit/live-ask';
import { readScales, type Scales } from '@feega/live-edit/theme-scales';
import { Styling } from '../messages';
import { StylingChoice } from '../settings';
import { stylingOf } from './styling';

export async function scalesOf(root: string, choice: StylingChoice): Promise<Scales | null> {
  return (await stylingOf(root, choice)) === Styling.Tailwind ? readScales(reader(root)) : null;
}
