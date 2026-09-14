---
"@ifc-lite/sandbox": patch
"@ifc-lite/sdk": patch
"@ifc-lite/viewer-core": patch
---

Keep an explicit empty entity list distinct from an omitted list when resetting viewer colors, so a zero-match reset is a no-op instead of clearing every override.
