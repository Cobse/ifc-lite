---
"@ifc-lite/wasm": patch
---

The RTC (relative-to-centre) anchor is now sampled from one window: every geometry-bearing entity of the file, in file order, up to the sampler's 50-usable-sample cap. It used to be whatever job list the caller happened to hold, so a single model could be re-based to several different anchors: `buildPrePassOnce` sampled 25 simple + 25 complex jobs, the streaming pre-pass the first 50 it had buffered, the native pipeline its own (optionally priority-sorted) schedule, and the grid / alignment / symbolic overlays every geometry entity in file order. Measured on the fetched fixture corpus, the overlays and `buildPrePassOnce` disagreed by 2.1 m on `ara3d/ISSUE_098_R8_F1_MAB_AR_M3_XX_XXX_MO_7000.IFC`, 5.2 m on `various/rvt01.ifc` and 349 m on `issues/859_linear_placement_of_signal.ifc`, which is how far off the meshes those files' grid and alignment lines were drawn. Those three now agree exactly, on `buildPrePassOnce`, on the native pipeline and on the overlays.

One case is unchanged and still open: the STREAMING pre-pass emits its frame mid-scan, before the file has been read, so it can only sample the part its index covers. On a model whose head does not represent the rest of the file it still picks a different anchor from the overlays, exactly as it did before. Closing that means handing the emitted frame to the overlay parse APIs rather than having them re-derive it, which is a change to the overlay wire contract; it is recorded on issue #4611.

The anchor a given model resolves to can therefore change. It is still subtracted from the vertices and reported as `rtcOffset`, so world positions are unaffected; only the frame the vertices are expressed in moves.
