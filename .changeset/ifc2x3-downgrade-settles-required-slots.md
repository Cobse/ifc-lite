---
"@ifc-lite/export": patch
"@ifc-lite/wasm": patch
---

Fixed a STEP export to IFC2X3: it kept `$` in every slot IFC2X3 requires a value in other than `OwnerHistory`, which #4686 covered. IFC4 made attributes optional that IFC2X3 declares mandatory, so a valid IFC4 record legitimately carries `$` there: an IFC4 footing written `#10=IFCFOOTING('2O2Fr$t4X7Zf8NOew3FLOH',$,'F',$,$,$,$,$,$);` came out of an IFC2X3 export unchanged, with `$` in the mandatory `PredefinedType`, which a strict IFC2X3 reader rejects (#4714).

Each slot now gets a recorded policy, driven by a generated table (`scripts/generate-ifc2x3-required-slots.mjs`, from the EXPRESS-derived IFC2X3 schema registry) rather than a hand-kept list: an enum whose IFC2X3 declaration has a `NOTDEFINED` member takes `.NOTDEFINED.`, a BOOLEAN takes `.F.`, and everything else keeps `$` and is counted. Nothing is invented: no measure, label, identifier or entity reference is fabricated, and an enum without a `NOTDEFINED` member — `IfcBuildingStorey.CompositionType`, for one — keeps `$` rather than being guessed. The table also feeds the `IfcDoorType` -> `IfcDoorStyle` attribute remap, replacing the four-entry map each language kept by hand.

The count reaches the caller through the channels #4686 added: `StepExportResult.stats.warnings` and `MergeExportResult.stats.warnings` in TypeScript, `MergedStats.warnings` and the new `StepStats.required_slots_unfilled` count in Rust.

Also fixes the property sets the Rust `export_step` synthesizes from `property_mutations`. They are built after the emit loop and never went through the converter, so an IFC2X3 export with property mutations wrote `$` in their `OwnerHistory` even when the file had one to point them at. They now go through the same fill, including when the source is already IFC2X3 and no conversion runs.

A record whose attribute count is not the one IFC2X3 declares is left untouched and not counted: its slots were never reconciled to that list, so writing into one could land on the wrong attribute.

`convertStepLine` now applies these defaults on every conversion to IFC2X3, including the argument forms that pass no fill object. The fill object is still how a caller gets the `OwnerHistory` reuse and the counts; the slots the schema itself can settle no longer depend on passing one. A call whose source schema already IS IFC2X3 still returns the line untouched, in TypeScript: it converts nothing. The Rust `export_step` does cover that case for the records it synthesizes, as described above.

This supersedes one sentence of 4.3.1's entry for #4686, which said of `convertStepLine` that "called without one it behaves as before". That was true when it shipped and is not any more: called without a fill, what it loses now is the `OwnerHistory` reuse and the counts, not the schema's own defaults.
