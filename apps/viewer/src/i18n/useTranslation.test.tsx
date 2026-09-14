/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import '@/test/setup-dom.js';
import { it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { render, cleanup } from '@/test/render';
import { useTranslation } from './useTranslation';
import { registerLocale, setLocale } from './registry';

afterEach(() => {
  cleanup();
  setLocale('en');
});

function Probe({ tag }: { tag: string }) {
  const { t } = useTranslation();
  return <span data-key={tag}>{t('mergeLayersBanner.reloadButton')}</span>;
}

it('resolves a key from the English catalogue by default', () => {
  const container = render(<Probe tag="default" />);
  const span = container.querySelector('span[data-key="default"]');
  assert.equal(span?.textContent, 'Reload');
});

it('falls back to English when the active locale is missing the key (#4785)', () => {
  // 'xx' deliberately omits 'mergeLayersBanner.reloadButton'.
  registerLocale('xx', { 'mergeLayersBanner.titleEnabled': 'XX enabled' });
  setLocale('xx');
  const container = render(<Probe tag="fallback" />);
  const span = container.querySelector('span[data-key="fallback"]');
  assert.equal(span?.textContent, 'Reload');
});

it('a translation deliberately set to an empty string is NOT treated as missing (#4785)', () => {
  // Distinguishes "translator left it blank on purpose" from "key absent".
  registerLocale('yy', { 'mergeLayersBanner.reloadButton': '' });
  setLocale('yy');
  const container = render(<Probe tag="blank" />);
  const span = container.querySelector('span[data-key="blank"]');
  assert.equal(span?.textContent, '');
});

it('re-renders mounted consumers when the active catalogue is replaced (#4785)', () => {
  registerLocale('replaceable', { 'mergeLayersBanner.reloadButton': 'First' });
  setLocale('replaceable');
  const container = render(<Probe tag="replacement" />);
  const span = container.querySelector('span[data-key="replacement"]');
  assert.equal(span?.textContent, 'First');

  act(() => {
    registerLocale('replaceable', { 'mergeLayersBanner.reloadButton': 'Second' });
  });
  assert.equal(span?.textContent, 'Second');
});
