---
"@ifc-lite/export": patch
"@ifc-lite/wasm": patch
---

Fix STEP export to IFC2X3 keeping `$` in `OwnerHistory`, which IFC2X3 requires on every `IfcRoot` entity but IFC4 leaves optional. An IFC4 wall written `#10=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOH',$,'Wall',$,$,#20,#30,$,$);` came out of an IFC2X3 export as `#10=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOH',$,'Wall',$,$,#20,#30,$);`, which a strict IFC2X3 reader rejects (#4686).

The downgrade now points a `$` OwnerHistory at the first `IfcOwnerHistory` the export writes. That covers every converted record, the `IFCPROXY` placeholder the converter writes for an entity with no IFC2X3 form, and overlay-created records in `StepExporter`. A record that names its own owner history keeps it. `MergedExporter` and the Rust `export_merged` use each model's own owner history, or one an earlier model wrote.

No owner history is invented. When the export writes none (the file has none, or a filtered export does not reach it), the slot stays `$` and the export says so: `StepExportResult.stats.warnings` and `MergeExportResult.stats.warnings` in TypeScript, `MergedStats.warnings` and the new `StepStats.owner_history_unfilled` count in Rust. `convertStepLine` takes the fill as an optional fifth argument; called without one it behaves as before.
