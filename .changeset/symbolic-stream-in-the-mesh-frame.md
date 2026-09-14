---
"@ifc-lite/server-bin": patch
---

The server's 2D symbol stream now comes back in the same frame as the meshes beside it. For a model whose `IfcSite` placement is translated, the parse re-expresses its meshes in the site's own frame (`mesh_coordinate_space: site_local`: the site translation subtracted, the site rotation removed), but the symbolic extractor resolved a frame of its own that has no site tier, so grid axes, annotation curves and text sat the whole site translation away from the geometry they annotate, rotated by the site's yaw. Every parse route now hands the extractor the frame its own meshes were baked in. Two cache namespaces retire the entries written in the old frame, so each affected file is parsed once more on its next request instead of being replayed: the symbolic sidecar moves to `-symbolic-v4`, and the stored `POST /api/v1/parse` response to `-json-v5`. The JSON one is needed on its own because that entry is the whole response with the symbols inside it, and it is returned before any extraction runs.

The browser path is unchanged: `parseSymbolicRepresentations` in the wasm bindings still resolves the overlay frame, which is the frame the browser's own meshes are in.
