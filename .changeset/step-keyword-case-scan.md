---
"@ifc-lite/parser": patch
---

The TypeScript STEP scanners (`StepTokenizer.scanEntitiesFast`, `StepTokenizer.scanEntities`, and the scan worker) no longer drop a record whose entity keyword starts with a lowercase letter. A file written as `#1=ifcwall(...)` used to yield no entities on those paths while the Rust scanner read it. Keyword case is not significant, so each record's `type` is now named in upper case: `ifcwall`, `IfcWall` and `IFCWALL` all come back as `IFCWALL`.
