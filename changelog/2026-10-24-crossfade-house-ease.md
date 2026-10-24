# Cross dissolve rides the house curve

**Before:** `JunctionKind.Crossfade` ran `Ease.Linear`; the other six transitions already ran
`Ease.Standard`.

**Now:** all seven run `Ease.Standard` (`feega.inOut`, the expo-like in-out curve with a soft
settle). Test: no junction kind is linear.

**Discarded:** a scene-specific curve. The junction spec is the one place that owns it.
