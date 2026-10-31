# Per-property style overrides

**Why.** Editing a style repainted every linked clip whole: a size set by hand on one headline was
wiped by the next style edit.

**What.** No stored override list. A property is overridden when its value differs from the
style's (`overridesOf`). A style edit reaches only the properties that still equal the old style
value; overridden ones stay. `resetOverride` puts one back. The Style section lists overridden
properties, each with a reset.

**Discarded.** A stored `styleOverrides` array on the clip: a second source of truth that drifts
from the props it describes.
