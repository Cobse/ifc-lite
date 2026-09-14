---
"@ifc-lite/server-client": major
---

`mesh_coordinate_space` is typed as the server's three-tier union (`'site_local' | 'model_rtc' | 'raw_ifc'`) on all five response and metadata-header interfaces, instead of `string`, and the client drops a value outside those three rather than passing it off as a tier. The union, a narrowing helper and the tier list are exported as `MeshCoordinateSpace`, `asMeshCoordinateSpace`, `withNarrowedCoordinateSpace` and `MESH_COORDINATE_SPACES`.

Major rather than minor, because both halves are breaking for a 2.x consumer:

- **Type.** `ParseResponse`, `ParquetMetadataHeader`, `ParquetParseResponse`, `OptimizedParquetMetadataHeader` and `OptimizedParquetParseResponse` are plain exported interfaces, so anything that CONSTRUCTS one (a test fixture, a mock server, a hand-rolled cache entry) with `mesh_coordinate_space: someString` stops compiling. Reading the field into a `string` is unaffected, because the union is assignable to `string`.
- **Runtime.** A server that sends a fourth value now reads as absent, with a console warning, where it used to read as that value.

**Migration.** Where you construct one of those interfaces, give the field one of the three literals, or run your value through `asMeshCoordinateSpace(value)`, which returns `MeshCoordinateSpace | undefined`:

```ts
import { asMeshCoordinateSpace, type MeshCoordinateSpace } from '@ifc-lite/server-client';

const space: MeshCoordinateSpace | undefined = asMeshCoordinateSpace(fromSomewhereElse);
```

Where you read it, nothing changes unless you relied on an unrecognised tag surviving the round trip; absence was already the documented state for a server that does not declare one.
