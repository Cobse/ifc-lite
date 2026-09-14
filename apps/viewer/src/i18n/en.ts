/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * The English catalogue (#4785). This is the source of truth for every
 * translation key: every other locale is a `Partial<Catalogue>` overlay,
 * and a key missing there falls back to the value here (see
 * `useTranslation.ts`). Adding a string to the UI means adding it here
 * first, under a namespace matching the component it belongs to.
 */
export const en = {
  'mergeLayersBanner.titleEnabled': 'Merge Multilayer Walls enabled',
  'mergeLayersBanner.titleDisabled': 'Merge Multilayer Walls disabled',
  'mergeLayersBanner.subtitle': 'Reload model to apply the new setting.',
  'mergeLayersBanner.reloadButton': 'Reload',
  'mergeLayersBanner.dismissAriaLabel': 'Dismiss reload reminder',
} as const;

export type TranslationKey = keyof typeof en;
