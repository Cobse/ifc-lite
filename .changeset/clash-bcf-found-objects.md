---
"@ifc-lite/viewer": patch
---

Fix clash-to-BCF export dropping the clashing pair as "found objects". `createBcfTopic` framed the pair via the clash-highlight colour channel (not selection, by design — #1277/#1339), so the exported viewpoint's `<Selection>` was entirely absent. The clash pair's GlobalIds and on-screen amber/cyan colours are now written into the viewpoint directly, independent of the live viewer selection.
