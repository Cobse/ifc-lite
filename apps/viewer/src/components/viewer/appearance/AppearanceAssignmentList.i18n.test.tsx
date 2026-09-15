/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import '@/test/setup-dom.js';
import { it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, cleanup } from '@/test/render.js';
import { DEFAULT_APPEARANCE_SETTINGS } from '@/lib/appearance/settings.js';
import { resolveAppearanceAssignments } from '@/lib/appearance/assignments/resolve.js';
import type { AppearanceAssignment } from '@/lib/appearance/assignments/types.js';
import { registerLocale, setLocale } from '@/i18n';
import { AppearanceAssignmentList } from './AppearanceAssignmentList.js';

afterEach(() => {
  cleanup();
  setLocale('en');
});

function assignment(id: string): AppearanceAssignment {
  return {
    id,
    model: { slotId: 'model-slot', modelId: 'model', name: 'Building', sourceSha256: 'a'.repeat(64), revision: 'r' },
    source: { id: 'b'.repeat(64), name: id, width: 2, height: 2 },
    settings: { ...DEFAULT_APPEARANCE_SETTINGS },
    query: { kind: 'model' },
    members: [{ expressId: 10, GlobalId: 'wall-0' }],
    excludedGlobalIds: [],
  };
}

const noop = () => {};

it('renders the English catalogue value by default (#4785)', () => {
  const container = render(
    <AppearanceAssignmentList
      rows={resolveAppearanceAssignments([assignment('Brick')])}
      disabled={false}
      objectName={() => 'Wall'}
      onMove={noop}
      onRemove={noop}
      onExclude={noop}
    />,
  );
  const section = container.querySelector('section[aria-label="Appearance assignments"]');
  assert.ok(section, 'section aria-label resolves from the catalogue');
  assert.ok(section.textContent?.includes('Assignments'));
  assert.ok(
    section.textContent?.includes(
      'Later assignments replace earlier ones on overlapping objects. Excluding an object here keeps any earlier assignment.',
    ),
  );
  assert.ok(section.textContent?.includes('Review objects and exceptions'));
});

it('renders a registered locale value when present, and falls back to English for a key that locale omits (#4785)', () => {
  // 'de' translates the heading but deliberately does not cover the
  // description — that key must still surface in English, not blank.
  registerLocale('de', { 'appearanceAssignmentList.heading': 'Zuweisungen' });
  setLocale('de');
  const container = render(
    <AppearanceAssignmentList
      rows={resolveAppearanceAssignments([assignment('Brick')])}
      disabled={false}
      objectName={() => 'Wall'}
      onMove={noop}
      onRemove={noop}
      onExclude={noop}
    />,
  );
  assert.ok(container.textContent?.includes('Zuweisungen'));
  // Fallback: English description, not an empty string.
  assert.ok(
    container.textContent?.includes(
      'Later assignments replace earlier ones on overlapping objects. Excluding an object here keeps any earlier assignment.',
    ),
  );
});
