# Text inspector: primary controls up front, the rest under Advanced type

**Before.** The Text section listed ~30 controls in one column: empty "Line height" and
"Letter spacing" override rows duplicated the Line/Spacing sliders, decoration details showed even
with no underline, and long labels truncated at 88px.

**Now.** `TEXT_TIER` (next to the text keys in `inspector-sections.ts`) maps every text property to
Primary, Advanced, Decorated or Hidden. Primary renders as a fixed layout (font, weight+size,
line+spacing, aligns, I/U/S + case). Everything else sits in a native `<details>` closed by default;
decoration details appear only while underline/strikethrough is on. The two string overrides stay in
Advanced, relabelled "Line override"/"Spacing override".

**Discarded.** A new font picker: `FontPicker` already exists and feat/org-fonts extends it.
