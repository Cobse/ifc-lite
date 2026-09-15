/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Measures the REAL WCAG contrast ratio of `PanelWindowHost`'s two
 * header/footer hints (#4825's second acknowledged harness gap) against
 * their REAL composited surface — a translucent `bg-muted/40` (header) /
 * `bg-muted/30` (footer) layered over the popped-out window's ancestor
 * `bg-background` — in light, dark and `.colorful`.
 *
 * `render-harness.ts`'s `measureTextContrastOnSurface` previously measured
 * only a surface's own (initial) background, resolved "over itself" —
 * correct for the app's other panel surfaces (`bg-background`, `bg-popover`,
 * `bg-card`, ...), all fully opaque, but wrong for a translucent layer: it
 * never actually blends with anything underneath. `PanelWindowHost.tsx`'s
 * header (`bg-muted/40`) and footer (`bg-muted/30`) strips are the only
 * sites in this shape (#4825), so they were unmeasurable until the harness
 * gained an explicit `backdropClassName` parameter — see that file's doc
 * comment for how the compositing is done (reusing the same canvas
 * compositor already used to resolve translucent TEXT onto its surface,
 * rather than a second one for translucent SURFACES).
 *
 * Each className is pulled from the component's SOURCE
 * (`extract-classname.ts`), not hardcoded here. The footer's text color is
 * not on its own `<span>` (unlike the header) — it sits on the same `<div>`
 * as the surface's `bg-muted/30`, and the "Live · synced..." text inherits
 * it — so the footer case passes the div's full extracted className as the
 * surface and an empty string as the text class, letting real CSS
 * inheritance (not a hardcoded split of the class string) resolve the
 * child `<span>`'s color, exactly like the component's real DOM.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measureTextContrastOnSurface, closeContrastBrowser, type Theme } from './render-harness';
import { extractClassNameAfter } from './extract-classname';
import { WCAG_AA_NORMAL_TEXT } from './wcag';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PANEL_WINDOW_HOST = join(__dirname, '../../components/viewer/dock/PanelWindowHost.tsx');

/** `PanelWindowHost`'s real ancestor surface (`PanelWindowChrome`'s root
 *  `<div className="... bg-background ...">`) that both the header and
 *  footer strips composite their translucency over. */
const BACKDROP = 'bg-background';

const THEMES: Theme[] = ['light', 'dark', 'colorful'];

after(async () => {
  await closeContrastBrowser();
});

describe('PanelWindowHost translucent header/footer hints meet WCAG AA on their composited surface (#4825)', () => {
  const fixedCases: Array<{ name: string; surfaceAnchor: string; textAnchor: string | null }> = [
    {
      name: 'header "Window"/"Picture-in-picture" hint',
      surfaceAnchor:
        '<div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">\n      <div ',
      textAnchor: '{def?.title ?? entry.id}</span>\n        <span ',
    },
    {
      name: 'footer "Live · synced with the main window" strip',
      surfaceAnchor: 'reinforces that this content is live. */}\n      <div ',
      textAnchor: null, // text inherits the surface div's own color, see file doc comment
    },
  ];

  for (const { name, surfaceAnchor, textAnchor } of fixedCases) {
    for (const theme of THEMES) {
      it(`${name} clears AA (${WCAG_AA_NORMAL_TEXT}:1) in ${theme} theme`, async () => {
        const surfaceClassName = extractClassNameAfter(PANEL_WINDOW_HOST, surfaceAnchor);
        const textClassName = textAnchor === null ? '' : extractClassNameAfter(PANEL_WINDOW_HOST, textAnchor);
        const ratio = await measureTextContrastOnSurface(theme, surfaceClassName, textClassName, BACKDROP);
        assert.ok(
          ratio >= WCAG_AA_NORMAL_TEXT,
          `expected >= ${WCAG_AA_NORMAL_TEXT}:1, measured ${ratio.toFixed(2)}:1 for surface="${surfaceClassName}" ` +
            `text="${textClassName}" over backdrop="${BACKDROP}" in ${theme} theme`,
        );
      });
    }
  }
});

describe('non-vacuousness proof: reintroducing the pre-#4825 /70 opacity tier reddens in every theme', () => {
  // Not extracted from source — deliberately renders the OLD, pre-fix
  // `text-muted-foreground/70` classes these two sites shipped, over their
  // real composited surface, to prove the harness and threshold actually
  // catch the regression rather than passing regardless of input.
  const regressedCases: Array<{ name: string; surface: string; text: string }> = [
    {
      name: 'header hint (pre-#4825, /70 over bg-muted/40)',
      surface: 'bg-muted/40',
      text: 'text-[9px] uppercase tracking-wide text-muted-foreground/70 shrink-0',
    },
    {
      name: 'footer strip (pre-#4825, /70 over bg-muted/30)',
      surface: 'bg-muted/30 text-[9px] text-muted-foreground/70',
      text: '',
    },
  ];

  for (const { name, surface, text } of regressedCases) {
    for (const theme of THEMES) {
      it(`${name} in ${theme} theme measures under AA (proves the harness is non-vacuous)`, async () => {
        const ratio = await measureTextContrastOnSurface(theme, surface, text, BACKDROP);
        assert.ok(
          ratio < WCAG_AA_NORMAL_TEXT,
          `expected the pre-#4825 regression to measure below AA; got ${ratio.toFixed(2)}:1 — ` +
            `either the harness stopped measuring correctly, or the theme tokens changed enough that ` +
            `this className is no longer a valid regression fixture`,
        );
      });
    }
  }
});
