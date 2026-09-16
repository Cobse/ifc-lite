/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Shared constants for section tool components
 */

// Axis display info for semantic names
export const AXIS_INFO = {
  down: {
    labelKey: 'sectionTool.axis.down', statusKey: 'sectionTool.hint.down',
    flippedStatusKey: 'sectionTool.hint.downFlipped', badgeKey: 'sectionTool.badge.down',
  },
  front: {
    labelKey: 'sectionTool.axis.front', statusKey: 'sectionTool.hint.front',
    flippedStatusKey: 'sectionTool.hint.frontFlipped', badgeKey: 'sectionTool.badge.front',
  },
  side: {
    labelKey: 'sectionTool.axis.side', statusKey: 'sectionTool.hint.side',
    flippedStatusKey: 'sectionTool.hint.sideFlipped', badgeKey: 'sectionTool.badge.side',
  },
} as const;
