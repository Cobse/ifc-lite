/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * `extract-classname.ts`'s own doc comment says it throws, rather than
 * silently matching nothing, "if the class ever becomes a template
 * literal or a `cn(...)` call" — true before this test existed, but
 * over-broad: a template literal whose class tokens are all literal text
 * (no `${...}` expression at all) is just as statically readable as a
 * plain quoted string, and CI's own #4825 follow-up wants to measure a
 * translucent surface's className that happens to be written with
 * backticks for no functional reason. This file locks in the narrower,
 * intended boundary: a LITERAL-ONLY template literal is now extracted like
 * any other className string; a template literal that actually
 * INTERPOLATES (any `${...}`) still throws loudly — extending the boundary
 * to "not runtime-interpolated" rather than "not a template literal at
 * all", while preserving the property the doc comment cares about: this
 * never silently returns a partial or best-guess string for a value it
 * cannot fully resolve statically.
 *
 * `CoordinateDisplay.tsx`'s value span still has real runtime interpolation,
 * while #4792 made its label a statically measurable muted-foreground class.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractClassNameAfter } from './extract-classname';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, '__fixtures__/template-literal-cases.tsx');
const COORDINATE_DISPLAY = join(__dirname, '../../components/viewer/properties/CoordinateDisplay.tsx');

describe('extractClassNameAfter handles a literal-only template literal', () => {
  it('extracts the class string from a backtick className with no interpolation', () => {
    const className = extractClassNameAfter(FIXTURE, '<span ');
    assert.equal(className, 'text-[9px] text-muted-foreground');
  });
});

describe('extractClassNameAfter still throws loudly on an interpolated template literal', () => {
  it('throws rather than silently matching nothing or guessing a branch', () => {
    assert.throws(
      () => extractClassNameAfter(FIXTURE, 'return (\n    <span '),
      /interpolat/i,
    );
  });
});

describe('CoordinateDisplay.tsx (#4792)', () => {
  it('extracts the now-static muted label class', () => {
    assert.equal(
      extractClassNameAfter(COORDINATE_DISPLAY, '{label && (\n        <span '),
      'text-[9px] font-medium uppercase tracking-wider w-[34px] shrink-0 pt-px text-muted-foreground',
    );
  });

  it('CoordRow value span still throws on real primary-prop interpolation', () => {
    assert.throws(
      () => extractClassNameAfter(COORDINATE_DISPLAY, '        </span>\n      )}\n      <span '),
      /interpolat/i,
    );
  });
});
