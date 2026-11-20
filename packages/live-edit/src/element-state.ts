export enum ElementState {
  Default = 'default',
  Hover = 'hover',
  Focus = 'focus',
  FocusVisible = 'focus-visible',
  Active = 'active',
  Disabled = 'disabled'
}

export enum Applies {
  Anywhere = 'anywhere',
  FormControls = 'form-controls'
}

type StateFacts = { label: string; pseudo: string; variant: string; applies: Applies };

export const STATE_FACTS: Record<ElementState, StateFacts> = {
  [ElementState.Default]: { label: 'Default', pseudo: '', variant: '', applies: Applies.Anywhere },
  [ElementState.Hover]: { label: 'Hover', pseudo: ':hover', variant: 'hover', applies: Applies.Anywhere },
  [ElementState.Focus]: { label: 'Focus', pseudo: ':focus', variant: 'focus', applies: Applies.Anywhere },
  [ElementState.FocusVisible]: { label: 'Focus visible', pseudo: ':focus-visible', variant: 'focus-visible', applies: Applies.Anywhere },
  [ElementState.Active]: { label: 'Active', pseudo: ':active', variant: 'active', applies: Applies.Anywhere },
  [ElementState.Disabled]: { label: 'Disabled', pseudo: ':disabled', variant: 'disabled', applies: Applies.FormControls }
};

export const pseudoOf = (state: ElementState = ElementState.Default) => STATE_FACTS[state].pseudo;

export const variantOfState = (state: ElementState = ElementState.Default) => STATE_FACTS[state].variant;

export const isElementState = (value: unknown): value is ElementState => typeof value === 'string' && value in STATE_FACTS;

const FORM_CONTROLS = new Set(['button', 'input', 'select', 'textarea', 'fieldset', 'optgroup', 'option']);

export const statesFor = (tag: string): ElementState[] =>
  (Object.values(ElementState) as ElementState[]).filter((s) => STATE_FACTS[s].applies === Applies.Anywhere || FORM_CONTROLS.has(tag.toLowerCase()));
