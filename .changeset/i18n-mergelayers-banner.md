---
"@ifc-lite/viewer": patch
---

Add a viewer string-catalogue mechanism (`apps/viewer/src/i18n`) so translated locales can be registered without touching component code, and convert the "Merge Multilayer Walls" reload banner as the first component using it. English remains the default; a registered locale missing a key falls back to English rather than rendering blank. This is a pattern-setter, not a full UI translation (refs #4785).
