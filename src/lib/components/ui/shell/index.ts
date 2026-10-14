import { DropdownMenu } from 'bits-ui';
import Panel from './Panel.svelte';
import PanelHeader from './PanelHeader.svelte';
import Section from './Section.svelte';
import Row from './Row.svelte';
import Field from './Field.svelte';
import IconButton from './IconButton.svelte';
import SegmentedControl, { type SegmentOption } from './SegmentedControl.svelte';
import Toolbar from './Toolbar.svelte';
import ToolbarDivider from './ToolbarDivider.svelte';
import Hint from './Hint.svelte';
import Kbd from './Kbd.svelte';
import MenuContent from './MenuContent.svelte';
import MenuItem from './MenuItem.svelte';
import MenuLabel from './MenuLabel.svelte';
import MenuSeparator from './MenuSeparator.svelte';

const Menu = DropdownMenu.Root;
const MenuTrigger = DropdownMenu.Trigger;

export * from './styles';
export * from './shortcut';
export {
  Panel,
  PanelHeader,
  Section,
  Row,
  Field,
  IconButton,
  SegmentedControl,
  type SegmentOption,
  Toolbar,
  ToolbarDivider,
  Hint,
  Kbd,
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator
};
