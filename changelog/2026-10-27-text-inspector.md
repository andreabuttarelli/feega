# Text inspector: primary controls up front, the rest under Advanced type

**Before.** The Text section listed ~30 controls in one column: empty "Line height" and
"Letter spacing" override rows duplicated the Line/Spacing sliders, decoration details showed even
with no underline, and long labels truncated at 88px.

**Now.** `TEXT_TIER` (next to the text keys in `inspector-sections.ts`) maps every text property to
Primary, Advanced, Decorated or Hidden. Primary renders as a fixed layout (font, weight+size,
line+spacing, aligns, I/U/S + case). Colour (the fill stack of a text element) follows the toggles. Everything else opens in a `SidePopover` (same as the Fill editor) from a settings button;
decoration details appear only while underline/strikethrough is on. The `lineHeight`/`letterSpacing` string overrides are hidden from the UI, still in the data model and reachable by agents via MCP.

**Discarded.** A new font picker: `FontPicker` already exists and feat/org-fonts extends it.
