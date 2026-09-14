/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * `entities()`'s `descriptor.filters` predicate, split out of
 * `headless-backend.ts` (module-size ratchet).
 *
 * Any-match, not first-match (#3490): an entity can carry two distinct
 * same-named property sets (type + occurrence), so a filter predicate
 * passes when ANY of them satisfies the condition, not just the first
 * one found. This applies uniformly to every operator, `!=` included.
 *
 * Falls back to quantity sets when no property set matches `filter.psetName`
 * (a `Qto_` filter otherwise matched zero entities even when the quantity
 * was present — the exact "silent empty result" defect class #4091
 * reported, discovered while wiring `#4094`'s `.select()`/`--select`
 * selector adapter, which can legitimately translate `Qto_WallBaseQuantities.
 * NetVolume>1` into this same `QueryFilter` shape). Mirrors the CLI
 * `--where` flag's own fallback (`applyWhereFilter` in
 * `commands/where-filter.ts`) so `bim.query().where('Qto_...', ...)` and
 * `--where 'Qto_...'` agree again.
 */

import type { PropertySetData, QuantitySetData, QueryFilter } from '@ifc-lite/sdk';
import { findAllPropertiesInSets, findAllQuantitiesInSets, compareFilterValue, type FilterComparisonOp } from '@ifc-lite/query';

// compareFilterValue is the same comparison the viewer SDK adapter, CLI
// --where flag, and MCP backend use for their QueryBackendMethods `where`,
// so this can't drift from their boolean-normalization/case-insensitive
// -`contains` semantics.
export function matchesPropertyFilter(
  props: PropertySetData[],
  filter: QueryFilter,
  qsets: QuantitySetData[] = [],
): boolean {
  const matchingProps = findAllPropertiesInSets(props, filter.psetName, filter.propName);
  if (matchingProps.length > 0) {
    if (filter.operator === 'exists') return true;
    return matchingProps.some((prop) =>
      compareFilterValue(prop.value, filter.operator as FilterComparisonOp, filter.value)
    );
  }
  const matchingQtys = findAllQuantitiesInSets(qsets, filter.psetName, filter.propName);
  if (matchingQtys.length === 0) return false;
  if (filter.operator === 'exists') return true;
  return matchingQtys.some((qty) =>
    compareFilterValue(qty.value, filter.operator as FilterComparisonOp, filter.value)
  );
}
