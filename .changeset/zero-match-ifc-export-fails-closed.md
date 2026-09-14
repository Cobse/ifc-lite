---
"@ifc-lite/sdk": major
"@ifc-lite/sandbox": patch
"@ifc-lite/cli": patch
"@ifc-lite/mcp": patch
"@ifc-lite/viewer": patch
---

`bim.export.ifc()` no longer exports the whole model when an isolation filter matched nothing. The ref list carried two meanings on one argument: a non-empty array isolated to those entities, and an empty array meant "no filter, export everything". A caller whose filter matched zero entities passed the empty array and got every entity back, reported as success. That is the same null-vs-empty collapse #4364/#4386 removed from the GLB and OBJ bindings and #4659 from the JSON-LD and STEP ones, and it is why every in-repo caller had to carry its own zero-match guard to stay safe. The viewer's MCP playground `export_ifc` had none, so `global_ids` that matched nothing staged the entire model as a download and described it as the requested subset.

`refs` is now optional: omit it (or pass `undefined`/`null`) for "no isolation filter", and pass an array for an active one. An active filter that matched nothing is refused with an error instead of widened back to a whole-model export. The check lives in `ExportNamespace.ifc`, the one point every surface (CLI, MCP, playground, sandboxed scripts, viewer) reaches a STEP export through, and the absence travels down with the call: a backend now receives `undefined` for "no filter" and never an empty array. The viewer's export adapter, which needs a model id and so refuses an empty ref list, uses that to export the active model whole; the sandbox bridge keeps an omitted `entities` argument omitted rather than turning it into `[]` (`bim.export.csv()` still answers an empty list, unchanged).

**Migration:** replace `bim.export.ifc([], options)` with `bim.export.ifc(undefined, options)` (or `bim.export.ifc()`), which is the same whole-model export. A call site that builds `refs` from a query keeps passing the array and now gets an error rather than the whole model when the query matched nothing. A custom `BimBackend` sees `undefined` where it used to see `[]` for an unfiltered export.
