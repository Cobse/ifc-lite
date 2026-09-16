/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import '@/test/setup-dom.js';
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { advance, cleanup, click, render, type } from '@/test/render.js';
import { registerLocale, setLocale, type Catalogue } from '@/i18n';
import { useViewerStore } from '@/store';
import { getDefaultSectionPlane } from '@/store/slices/sectionSlice.js';
import { ToolOverlays } from '../ToolOverlays.js';

const TEST_LOCALE: Catalogue = {
  'sectionTool.heading': 'Coupe',
  'sectionTool.dragTitle': 'Déplacer le panneau',
  'sectionTool.closeTitle': 'Fermer',
  'sectionTool.openDrawingTitle': 'Ouvrir le dessin en panneau',
  'sectionTool.openDrawingButton': 'Ouvrir le dessin',
  'sectionTool.header.axis': '{position}% — {axis}',
  'sectionTool.header.custom': '{distance} m : coupe personnalisée',
  'sectionTool.axis.down': 'Bas',
  'sectionTool.axis.front': 'Avant',
  'sectionTool.axis.side': 'Côté',
  'sectionTool.pick.activeTitle': 'Cliquez une face dans la vue',
  'sectionTool.pick.title': 'Choisir une face',
  'sectionTool.pick.activeLabel': 'Cliquez une face…',
  'sectionTool.pick.customLabel': 'Personnalisée (rechoisir)',
  'sectionTool.pick.label': 'Choisir face',
  'sectionTool.axisPrompt': 'ou choisissez un axe',
  'sectionTool.normalTitle': 'Normale du plan personnalisé',
  'sectionTool.resetAxisTitle': 'Revenir à un axe',
  'sectionTool.distanceLabel': 'Distance locale',
  'sectionTool.positionLabel': 'Position locale',
  'sectionTool.flipLabel': 'Inverser la coupe',
  'sectionTool.unflipLabel': 'Rétablir la coupe',
  'sectionTool.flippedTitle': 'Direction inversée',
  'sectionTool.distanceAriaLabel': 'Distance du plan local',
  'sectionTool.positionAriaLabel': 'Pourcentage du plan local',
  'sectionTool.sliderAriaLabel': 'Curseur du plan local',
  'sectionTool.hint.pick': 'Survolez puis cliquez',
  'sectionTool.hint.off': 'Coupe inactive',
  'sectionTool.hint.down': '{position}% : coupe vers le bas',
  'sectionTool.hint.downFlipped': '{position}% : coupe bas inversée',
  'sectionTool.hint.front': '{position}% : coupe avant',
  'sectionTool.hint.frontFlipped': '{position}% : coupe avant inversée',
  'sectionTool.hint.side': '{position}% : coupe latérale',
  'sectionTool.hint.sideFlipped': '{position}% : coupe latérale inversée',
  'sectionTool.hint.custom': '{distance} m : coupe personnalisée',
  'sectionTool.hint.customFlipped': '{distance} m : coupe personnalisée inversée',
  'sectionTool.clipping.onLabel': 'Coupe active',
  'sectionTool.clipping.offLabel': 'Coupe inactive',
  'sectionTool.clipping.disableTitle': 'Désactiver la coupe',
  'sectionTool.clipping.enableTitle': 'Activer la coupe',
};

function button(ui: HTMLElement, text: string): HTMLButtonElement {
  const result = [...ui.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.trim() === text || candidate.title === text || candidate.getAttribute('aria-label') === text);
  assert.ok(result, `button ${text}`);
  return result;
}

function expand(ui: HTMLElement): void {
  const heading = [...ui.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes('Section'));
  assert.ok(heading);
  click(heading);
}

function input(ui: HTMLElement, label: string): HTMLInputElement {
  const result = ui.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  assert.ok(result, `input ${label}`);
  return result;
}

function hint(ui: HTMLElement): string {
  return [...ui.querySelectorAll('span')].find((node) => node.classList.contains('tracking-wide'))?.textContent ?? '';
}

function headerStatus(ui: HTMLElement): string {
  return [...ui.querySelectorAll('button span')].find((node) =>
    node.classList.contains('tabular-nums'))?.textContent ?? '';
}

function labelledControl<T extends HTMLElement>(ui: HTMLElement, label: string): T {
  const labelElement = [...ui.querySelectorAll('label')].find((candidate) => candidate.textContent?.trim() === label);
  assert.ok(labelElement, `label ${label}`);
  const control = ui.querySelector<T>(`#${CSS.escape(labelElement.htmlFor)}`);
  assert.ok(control, `control ${label}`);
  return control;
}

beforeEach(() => {
  window.localStorage.clear();
  setLocale('en');
  useViewerStore.setState({
    activeTool: 'section',
    sectionPlane: getDefaultSectionPlane(),
    sectionPickMode: false,
    sectionPickPreview: null,
    pointCloudAssetCount: 1,
    pointCloudPreviewStride: 1,
    drawing2DPanelVisible: false,
    drawing2D: null,
  });
});

afterEach(() => {
  cleanup();
  setLocale('en');
  window.localStorage.clear();
});

describe('mounted Section tool localization (#4785)', () => {
  it('preserves default English controls, cardinal states and clipping behavior', () => {
    window.localStorage.setItem('ifc-lite:section-last-mode', JSON.stringify({ kind: 'cardinal', axis: 'down', position: 50, flipped: false }));
    const ui = render(<ToolOverlays />);
    assert.match(ui.textContent ?? '', /Section/);
    assert.equal(ui.querySelector<HTMLElement>('[title="Drag to move"]')?.title, 'Drag to move');
    assert.equal(button(ui, 'Open 2D Drawing Panel').title, 'Open 2D Drawing Panel');
    expand(ui);
    assert.match(ui.textContent ?? '', /Pick face/);
    assert.ok(input(ui, 'Section plane position percentage'));
    assert.ok(input(ui, 'Section plane position slider'));

    for (const [axis, status] of [['Down', 'Cut down at 37.5%'], ['Front', 'Cut front at 37.5%'], ['Side', 'Cut side at 37.5%']] as const) {
      click(button(ui, axis));
      type(input(ui, 'Section plane position percentage'), '37.5');
      assert.equal(hint(ui), status);
      const flip = button(ui, 'Flip cut direction');
      click(flip);
      assert.equal(button(ui, 'Unflip cut direction').title, 'Cut direction is flipped');
      assert.equal(hint(ui), `${status} (flipped)`);
      click(button(ui, 'Unflip cut direction'));
    }

    const clipping = button(ui, 'Clipping');
    assert.equal(clipping.title, 'Click to disable the cut');
    assert.match([...ui.querySelectorAll('svg text')].map((node) => node.textContent).join(' '), /CUT/);
    click(clipping);
    assert.equal(button(ui, 'Clip off').title, 'Click to enable the cut');
    assert.doesNotMatch([...ui.querySelectorAll('svg text')].map((node) => node.textContent).join(' '), /CUT/);
  });

  it('renders whole reordered messages for translated cardinal and signed custom state', () => {
    registerLocale('section-test', TEST_LOCALE);
    window.localStorage.setItem('ifc-lite:section-last-mode', JSON.stringify({ kind: 'cardinal', axis: 'front', position: 50, flipped: false }));
    setLocale('section-test');
    const ui = render(<ToolOverlays />);
    assert.match(ui.textContent ?? '', /50\.0% — Avant/);
    const heading = [...ui.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes('Coupe'));
    assert.ok(heading);
    click(heading);
    type(input(ui, 'Pourcentage du plan local'), '37.5');
    assert.equal(hint(ui), '37.5% : coupe avant');
    click(button(ui, 'Inverser la coupe'));
    assert.equal(hint(ui), '37.5% : coupe avant inversée');

    act(() => useViewerStore.getState().setSectionPlaneFromFace([1, 0, 0], [-2.345, 0, 0]));
    assert.equal(headerStatus(ui), '-2.35 m : coupe personnalisée');
    assert.equal(hint(ui), '-2.35 m : coupe personnalisée');
    assert.ok(input(ui, 'Distance du plan local'));
    assert.equal(ui.querySelector('[title="Normale du plan personnalisé"]')?.textContent, 'n=(1.00, 0.00, 0.00)');
    click(button(ui, 'Inverser la coupe'));
    assert.equal(hint(ui), '-2.35 m : coupe personnalisée inversée');
    type(input(ui, 'Distance du plan local'), '-1.125');
    assert.equal(useViewerStore.getState().sectionPlane.custom?.distance, -1.125);
    assert.equal(headerStatus(ui), '-1.13 m : coupe personnalisée');
    assert.equal(hint(ui), '-1.13 m : coupe personnalisée inversée');
    click(button(ui, 'Revenir à un axe'));
    assert.equal(useViewerStore.getState().sectionPlane.custom, undefined);
    assert.match(hint(ui), /coupe latérale/);
  });

  it('uses exact fallback, preserves explicit blank text and restores English for an unknown locale', () => {
    registerLocale('partial-section', {
      'sectionTool.heading': 'Localized section',
      'sectionTool.axisPrompt': '',
    });
    window.localStorage.setItem('ifc-lite:section-last-mode', JSON.stringify({ kind: 'cardinal', axis: 'front', position: 42.25, flipped: false }));
    setLocale('partial-section');
    const ui = render(<ToolOverlays />);
    assert.match(ui.textContent ?? '', /Localized section/);
    const heading = [...ui.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes('Localized section'));
    assert.ok(heading);
    click(heading);
    assert.equal(hint(ui), 'Cut front at 42.3%');
    assert.equal(button(ui, 'Pick face').title, 'Pick a face to cut through (Bonsai-style)');
    assert.ok(ui.querySelector('[aria-label="Section plane position slider"]'));
    const blankPrompt = [...ui.querySelectorAll('div')].find((node) =>
      node.classList.contains('uppercase') && node.classList.contains('mt-2'));
    assert.ok(blankPrompt, 'the explicit blank prompt remains mounted');
    assert.equal(blankPrompt.textContent, '');
    const plane = useViewerStore.getState().sectionPlane;
    act(() => setLocale('missing-locale'));
    assert.match(ui.textContent ?? '', /Section/);
    assert.equal(useViewerStore.getState().sectionPlane, plane);
  });

  it('updates a mounted active catalogue without remounting or losing state and does not restart face-pick timing', async () => {
    registerLocale('live-section', TEST_LOCALE);
    window.localStorage.setItem('ifc-lite:section-last-mode', JSON.stringify({ kind: 'cardinal', axis: 'side', position: 22, flipped: false }));
    const loadedModels = new Map(useViewerStore.getState().models);
    loadedModels.set('locale-model', { id: 'locale-model' } as never);
    const selectedIds = new Set([321]);
    useViewerStore.setState({ models: loadedModels, selectedEntityId: 321, selectedEntityIds: selectedIds });
    const ui = render(<ToolOverlays />);
    expand(ui);
    type(input(ui, 'Section plane position percentage'), '37.5');
    click(button(ui, 'Flip cut direction'));
    const pattern = labelledControl<HTMLSelectElement>(ui, 'Hatch pattern');
    act(() => {
      pattern.value = 'brick';
      pattern.dispatchEvent(new Event('change', { bubbles: true }));
    });
    type(input(ui, 'Fill colour'), '#336699');
    act(() => useViewerStore.getState().setSectionPlaneFromFace([1, 0, 0], [-2.5, 0, 0]));
    click(button(ui, 'Flip cut direction'));
    const focused = input(ui, 'Section plane distance along picked normal (world units)');
    type(focused, '-1.25');
    focused.focus();
    const panel = ui.querySelector('[data-tour="section-panel"]') ?? focused.closest('.pointer-events-auto');
    assert.ok(panel instanceof HTMLElement);
    const dragHandle = panel.querySelector<HTMLElement>('[title="Drag to move"]');
    assert.ok(dragHandle);
    act(() => {
      dragHandle.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }));
      window.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true, clientX: 90, clientY: 70 }));
      window.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
    });
    const movedPosition = { top: panel.style.top, left: panel.style.left };
    assert.deepEqual(movedPosition, { top: '60px', left: '80px' });
    const slider = input(ui, 'Section plane position slider');
    slider.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }));
    assert.equal(useViewerStore.getState().pointCloudPreviewStride, 4);
    const storedMode = window.localStorage.getItem('ifc-lite:section-last-mode');
    const storedCapStyle = window.localStorage.getItem('ifc-lite:section-cap-style');
    const planeBeforeSwitch = useViewerStore.getState().sectionPlane;

    act(() => setLocale('live-section'));
    assert.equal(input(ui, 'Distance du plan local'), focused);
    assert.equal(input(ui, 'Curseur du plan local'), slider);
    assert.equal(document.activeElement, focused);
    assert.equal(ui.querySelector('[data-tour="section-panel"]') ?? focused.closest('.pointer-events-auto'), panel);
    assert.deepEqual({ top: panel.style.top, left: panel.style.left }, movedPosition);
    assert.equal(useViewerStore.getState().sectionPlane, planeBeforeSwitch);
    assert.equal(useViewerStore.getState().sectionPlane.custom?.distance, -1.25);
    assert.equal(useViewerStore.getState().sectionPlane.capStyle.pattern, 'brick');
    assert.deepEqual(useViewerStore.getState().sectionPlane.capStyle.fillColor, [0.2, 0.4, 0.6, 1]);
    assert.equal(useViewerStore.getState().pointCloudPreviewStride, 4);
    assert.equal(window.localStorage.getItem('ifc-lite:section-last-mode'), storedMode);
    assert.equal(window.localStorage.getItem('ifc-lite:section-cap-style'), storedCapStyle);
    assert.equal(useViewerStore.getState().models, loadedModels);
    assert.equal(useViewerStore.getState().selectedEntityId, 321);
    assert.equal(useViewerStore.getState().selectedEntityIds, selectedIds);

    act(() => registerLocale('live-section', { ...TEST_LOCALE, 'sectionTool.heading': 'Coupe remplacée', 'sectionTool.hint.customFlipped': 'Remplacé {distance}' }));
    assert.match(ui.textContent ?? '', /Coupe remplacée/);
    assert.equal(hint(ui), 'Remplacé -1.25');
    slider.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true }));
    assert.equal(useViewerStore.getState().pointCloudPreviewStride, 1);

    act(() => setLocale('en'));
    assert.equal(input(ui, 'Section plane distance along picked normal (world units)'), focused);
    assert.equal(document.activeElement, focused);
    assert.equal(ui.querySelector('[data-tour="section-panel"]') ?? focused.closest('.pointer-events-auto'), panel);
    assert.deepEqual({ top: panel.style.top, left: panel.style.left }, movedPosition);
    assert.equal(useViewerStore.getState().sectionPlane, planeBeforeSwitch);
    assert.equal(window.localStorage.getItem('ifc-lite:section-last-mode'), storedMode);
    assert.equal(window.localStorage.getItem('ifc-lite:section-cap-style'), storedCapStyle);
    assert.equal(useViewerStore.getState().models, loadedModels);
    assert.equal(useViewerStore.getState().selectedEntityId, 321);
    assert.equal(useViewerStore.getState().selectedEntityIds, selectedIds);
  });

  it('does not restart the delayed face-pick timer when the locale changes', async () => {
    registerLocale('section-test', TEST_LOCALE);
    const ui = render(<ToolOverlays />);
    assert.equal(useViewerStore.getState().sectionPickMode, false);
    await advance(100);
    act(() => setLocale('section-test'));
    assert.match(ui.textContent ?? '', /Coupe/);
    assert.equal(useViewerStore.getState().sectionPickMode, false, 'the original delay is still pending at the locale switch');
    await advance(110);
    assert.equal(useViewerStore.getState().sectionPickMode, true, 'locale rerender did not restart the mount timer');
    act(() => {
      useViewerStore.getState().setSectionPickMode(false);
      setLocale('en');
    });
    await advance(220);
    assert.equal(useViewerStore.getState().sectionPickMode, false, 'a locale switch after disarming does not rearm pick mode');
  });

  it('translates delayed face-pick instructions and preserves drawing and close actions', async () => {
    registerLocale('section-test', TEST_LOCALE);
    setLocale('section-test');
    const ui = render(<ToolOverlays />);
    await advance(220);
    const heading = [...ui.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes('Coupe'));
    assert.ok(heading);
    click(heading);
    const pick = button(ui, 'Cliquez une face…');
    assert.equal(pick.title, 'Cliquez une face dans la vue');
    click(pick);
    assert.equal(button(ui, 'Choisir face').title, 'Choisir une face');

    useViewerStore.setState({ drawing2D: { marker: 'stale' } as never });
    click(button(ui, 'Ouvrir le dessin en panneau'));
    assert.equal(useViewerStore.getState().drawing2DPanelVisible, true);
    assert.equal(useViewerStore.getState().drawing2D, null);

    act(() => useViewerStore.setState({ drawing2DPanelVisible: false, drawing2D: { marker: 'again' } as never }));
    click(button(ui, 'Ouvrir le dessin'));
    assert.equal(useViewerStore.getState().drawing2D, null);
    assert.equal(useViewerStore.getState().drawing2DPanelVisible, true);

    click(button(ui, 'Fermer'));
    assert.equal(useViewerStore.getState().activeTool, 'select');
    assert.equal(ui.textContent, '');
    assert.equal(useViewerStore.getState().pointCloudPreviewStride, 1);
  });
});
