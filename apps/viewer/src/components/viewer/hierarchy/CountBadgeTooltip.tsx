/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { countBadgeLines } from './countBadgeLabel';
import type { ObjectCountSummary } from './objectCountSummary';

/** The hover card behind a tree row's count badge — headline first, then only
 *  the breakdown lines that have something to say. Spatial rows arrive with
 *  their lines already built (`TreeNode.countTooltipLines`); every other row
 *  falls back to the plain wording for whatever its badge counts. */
export function CountBadgeTooltip({
  elementCount,
  lines,
  summary,
}: {
  elementCount: number;
  lines?: string[];
  summary?: ObjectCountSummary;
}) {
  const [headline, ...rest] = lines ?? countBadgeLines(elementCount, summary);
  return (
    <>
      <p className="text-xs">{headline}</p>
      {/* TooltipContent uses the neutral popover surface; secondary copy uses
          its semantic muted token instead of a hardcoded zinc shade. */}
      {rest.map((line) => (
        <p key={line} className="text-[10px] text-muted-foreground">{line}</p>
      ))}
    </>
  );
}
