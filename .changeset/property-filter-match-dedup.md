---
"@ifc-lite/query": minor
"@ifc-lite/cli": patch
"@ifc-lite/mcp": patch
---

Deduplicate `matchesPropertyFilter`: the CLI and MCP query backends each carried their own copy of this `entities()`/`query_entities` filter predicate (`packages/cli/src/property-filter-match.ts`, `packages/mcp/src/property-filter-match.ts`) — functional twins differing only in comments, with nothing enforcing they stayed identical. One of the comments claimed a "can't drift" guarantee the code never actually enforced. Both packages already depend on `@ifc-lite/query` for the helpers this function is built from, so there is now exactly one implementation, exported from `@ifc-lite/query`, that both `HeadlessBackend` (CLI) and the MCP backend import. No behavior change.
