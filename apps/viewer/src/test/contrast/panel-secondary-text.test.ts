/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Measures the REAL WCAG contrast ratio of the panel secondary-text sites
 * fixed under #4792 (the tooltip-survey follow-up to #4788/#4783), against
 * each site's REAL surface, in light, dark and `.colorful` — the same real
 * headless-Chromium measurement `tooltip-secondary-text.test.ts` uses for
 * the popover-tooltip surface, generalized via `render-harness.ts`'s
 * `measureTextContrastOnSurface(theme, surfaceClass, textClass)` to the
 * non-tooltip surfaces (`bg-background`, `bg-popover`, and
 * `PropertiesPanel`'s literal `bg-white dark:bg-black`) these sites
 * actually sit on.
 *
 * #4792's survey measured every distinct `text-muted-foreground/NN` opacity
 * tier against the app's neutral panel surfaces and found every low-opacity
 * tier fails AA normal-text (4.5:1) in at least one shipped theme, while the
 * plain (no-opacity) `text-muted-foreground` clears it everywhere with
 * margin (survey's "Clean" section: 4.83:1 light / 5.42:1 dark / 5.76-6.66:1
 * colorful on `bg-background`/`bg-card`/`bg-popover`). The fix applied here
 * follows that same pattern already used for BsddCard's dataType line
 * (#4788/#4784): drop the opacity suffix rather than invent a new color.
 *
 * Each site's className is pulled from the component's SOURCE
 * (`extract-classname.ts`), not hardcoded here, so a future edit that
 * reintroduces a low-opacity tier is what turns this test red.
 *
 * Each className appears once per file even where the same component
 * renders it at several call sites (e.g. `MeasureQuantities.tsx`'s
 * quantity-row label is the same class repeated across many rows) — a WCAG
 * ratio for a given `(surfaceClass, textClass, theme)` triple is a pure
 * function of those three inputs, so measuring one representative
 * occurrence of a given className covers every other occurrence of that
 * exact className.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measureTextContrastOnSurface, closeContrastBrowser, type Theme } from './render-harness';
import { extractClassNameAfter } from './extract-classname';
import { WCAG_AA_NORMAL_TEXT } from './wcag';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VIEWER_DIR = join(__dirname, '../../components/viewer');
const CHAT_PANEL = join(VIEWER_DIR, 'ChatPanel.tsx');
const PROPERTIES_PANEL = join(VIEWER_DIR, 'PropertiesPanel.tsx');
const CLASH_PANEL = join(VIEWER_DIR, 'ClashPanel.tsx');
const TOUR_STEP_CARD = join(__dirname, '../../components/tours/TourStepCard.tsx');
const HOVER_TOOLTIP = join(VIEWER_DIR, 'HoverTooltip.tsx');
const MEASURE_PANEL = join(VIEWER_DIR, 'tools/MeasurePanel.tsx');
const MEASURE_QUANTITIES = join(VIEWER_DIR, 'tools/MeasureQuantities.tsx');
const MEASURE_POINT_READOUT = join(VIEWER_DIR, 'tools/MeasurePointReadout.tsx');

/** `PropertiesPanel`'s panel background — a literal `bg-white dark:bg-black`,
 *  not the `bg-background`/`bg-card` semantic tokens the rest of the viewer
 *  uses (see the panel's outer `<div>`, e.g. around its `ScrollArea`). No
 *  `.colorful`-specific override exists, so colorful renders the same
 *  `bg-white` as light. */
const PROPERTIES_PANEL_SURFACE = 'bg-white dark:bg-black';

const THEMES: Theme[] = ['light', 'dark', 'colorful'];

after(async () => {
  await closeContrastBrowser();
});

describe('panel secondary text meets WCAG AA on its real surface (#4792)', () => {
  const fixedCases: Array<{ name: string; file: string; anchor: string; surface: string }> = [
    {
      name: 'ChatPanel "Streaming..." status',
      file: CHAT_PANEL,
      anchor: 'flex items-center justify-between mt-1 px-0.5">\n          {isActive ? (\n            <span ',
      surface: 'bg-background',
    },
    {
      name: 'ChatPanel usage percentage readout',
      file: CHAT_PANEL,
      anchor: '        />\n                  </div>\n                  <span ',
      surface: 'bg-background',
    },
    {
      name: 'ChatPanel "Shift+Enter new line" hint',
      file: CHAT_PANEL,
      anchor: 't>\n            </Tooltip>\n          ) : (\n            <span ',
      surface: 'bg-background',
    },
    {
      name: 'ChatPanel "⌘L" shortcut hint',
      file: CHAT_PANEL,
      anchor: 'd">Shift+Enter new line</span>\n          )}\n          <span ',
      surface: 'bg-background',
    },
    {
      name: 'PropertiesPanel "Size" label',
      file: PROPERTIES_PANEL,
      anchor: ' <div className="flex items-start gap-1.5">\n                    <span ',
      surface: PROPERTIES_PANEL_SURFACE,
    },
    {
      name: 'PropertiesPanel "Size" value',
      file: PROPERTIES_PANEL,
      anchor: '-wider w-[34px] shrink-0 pt-px">Size</span>\n                    <span ',
      surface: PROPERTIES_PANEL_SURFACE,
    },
    {
      name: 'ClashPanel active detection-mode label',
      file: CLASH_PANEL,
      anchor: '5 w-3.5" />}\n              <span>Detection</span>\n              <span ',
      surface: 'bg-background',
    },
    {
      name: 'TourStepCard "docked back" notice',
      file: TOUR_STEP_CARD,
      anchor: 'ted-foreground">{step.body}</p>\n\n      {redockedPanel && (\n        <p ',
      surface: 'bg-popover',
    },
    {
      name: 'TourStepCard "Stuck? Skip" hint',
      file: TOUR_STEP_CARD,
      anchor: '        </p>\n      )}\n      {hintVisible && !showNext && (\n        <p ',
      surface: 'bg-popover',
    },
    {
      name: 'TourStepCard step-count readout',
      file: TOUR_STEP_CARD,
      anchor: 'assName="mt-3 flex items-center justify-between gap-2">\n        <span ',
      surface: 'bg-popover',
    },
    {
      name: 'HoverTooltip world-coordinate readout',
      file: HOVER_TOOLTIP,
      anchor: 'e.entityId}\n      </div>\n      {hoverState.worldXYZ && (\n        <div ',
      surface: 'bg-popover',
    },
    {
      name: 'MeasurePanel projected-CRS name',
      file: MEASURE_PANEL,
      anchor: 'reground">m</span>\n            </div>\n          </div>\n          <div ',
      surface: 'bg-background',
    },
    {
      name: 'MeasureQuantities row label',
      file: MEASURE_QUANTITIES,
      anchor: "e-nowrap\"\n              title={r.provenance.join('\\n')}\n            >\n              <span ",
      surface: 'bg-background',
    },
    {
      name: 'MeasureQuantities net/gross/mesh footnote',
      file: MEASURE_QUANTITIES,
      anchor: 'be compared\n          instead of quietly differing. */}\n      {!nothing && (\n        <div ',
      surface: 'bg-background',
    },
    {
      name: 'MeasurePointReadout coordinate-row label',
      file: MEASURE_POINT_READOUT,
      anchor: '\n  return (\n    <div className="flex items-baseline gap-2 whitespace-nowrap">\n      <span ',
      surface: 'bg-background',
    },
    {
      name: 'MeasurePointReadout rebased-frame notice',
      file: MEASURE_POINT_READOUT,
      anchor: "oFixed(6)}`}\n          />\n        )}\n      </div>\n\n      {frame.rebased && (\n        <div ",
      surface: 'bg-background',
    },
    {
      name: 'MeasurePointReadout projected-CRS readout',
      file: MEASURE_POINT_READOUT,
      anchor: "ly the picked file's own.\n        </div>\n      )}\n\n      {enh && anchor && (\n        <div ",
      surface: 'bg-background',
    },
  ];

  for (const { name, file, anchor, surface } of fixedCases) {
    for (const theme of THEMES) {
      it(`${name} clears AA (${WCAG_AA_NORMAL_TEXT}:1) in ${theme} theme`, async () => {
        const className = extractClassNameAfter(file, anchor);
        const ratio = await measureTextContrastOnSurface(theme, surface, className);
        assert.ok(
          ratio >= WCAG_AA_NORMAL_TEXT,
          `expected >= ${WCAG_AA_NORMAL_TEXT}:1, measured ${ratio.toFixed(2)}:1 for className="${className}" ` +
            `on surface="${surface}" in ${theme} theme`,
        );
      });
    }
  }
});

describe('non-vacuousness proof: reintroducing the old opacity tiers reddens in every theme', () => {
  // Not extracted from source — deliberately renders the OLD, pre-fix
  // classes these sites shipped before #4792, to prove the harness and
  // threshold actually catch the regression rather than passing regardless
  // of input. Do not "fix" these by extracting from source.
  const regressedCases: Array<{ name: string; surface: string; className: string }> = [
    { name: 'ChatPanel hints (pre-#4792, /30-/50 tiers)', surface: 'bg-background', className: 'text-[10px] text-muted-foreground/40' },
    { name: 'PropertiesPanel "Size" (pre-#4792, /50)', surface: PROPERTIES_PANEL_SURFACE, className: 'text-[9px] font-medium text-muted-foreground/50' },
    { name: 'ClashPanel mode label (pre-#4792, /60)', surface: 'bg-background', className: 'normal-case tracking-normal text-muted-foreground/60' },
    { name: 'TourStepCard / HoverTooltip / MeasurePanel (pre-#4792, /80)', surface: 'bg-popover', className: 'text-[11px] text-muted-foreground/80' },
    { name: 'MeasureQuantities / MeasurePointReadout (pre-#4792, /70)', surface: 'bg-background', className: 'font-mono text-[9px] leading-tight text-muted-foreground/70' },
  ];

  for (const { name, surface, className } of regressedCases) {
    for (const theme of THEMES) {
      it(`${name} in ${theme} theme measures under AA (proves the harness is non-vacuous)`, async () => {
        const ratio = await measureTextContrastOnSurface(theme, surface, className);
        assert.ok(
          ratio < WCAG_AA_NORMAL_TEXT,
          `expected the pre-#4792 regression to measure below AA; got ${ratio.toFixed(2)}:1 — ` +
            `either the harness stopped measuring correctly, or the theme tokens changed enough that ` +
            `this className is no longer a valid regression fixture`,
        );
      });
    }
  }
});
