/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Regression coverage for #4843: the Inspector reports a storey's absolute
 * georeferenced elevation while the hierarchy keeps its relative value.
 */

import '@/test/setup-dom.js';

import { afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IfcParser, type IfcDataStore } from '@ifc-lite/parser';
import { cleanup, render } from '@/test/render.js';
import { useViewerStore } from '@/store';
import type { FederatedModel } from '@/store/types.js';
import { PropertiesPanel } from './PropertiesPanel.js';

const STOREY_ID = 41;

function source({
  elevation,
  ancestorElevation = 0,
  orthogonalHeight,
  unitPrefix = '$',
  withGeoref = true,
}: {
  elevation: number;
  ancestorElevation?: number;
  orthogonalHeight: number;
  unitPrefix?: '$' | '.MILLI.';
  withGeoref?: boolean;
}): string {
  const pointElevation = unitPrefix === '.MILLI.' ? elevation * 1_000 : elevation;
  const ancestorPointElevation = unitPrefix === '.MILLI.'
    ? ancestorElevation * 1_000
    : ancestorElevation;
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION((''),'2;1');
FILE_NAME('storey.ifc','',(''),(''),'','','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('0Project0000000000000a',$,'Project',$,$,$,$,(#10),#20);
#10=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-5,#11,$);
#11=IFCAXIS2PLACEMENT3D(#12,$,$);
#12=IFCCARTESIANPOINT((0.,0.,0.));
#20=IFCUNITASSIGNMENT((#21));
#21=IFCSIUNIT(*,.LENGTHUNIT.,${unitPrefix},.METRE.);
#40=IFCLOCALPLACEMENT(#50,#43);
#43=IFCAXIS2PLACEMENT3D(#44,$,$);
#44=IFCCARTESIANPOINT((0.,0.,${pointElevation}.));
#41=IFCBUILDINGSTOREY('0Storey000000000000041',$,'Level',$,$,#40,$,$,.ELEMENT.,$);
#42=IFCBUILDING('0Building000000000042',$,'Building',$,$,#50,$,$,.ELEMENT.,$,$,$);
#45=IFCRELAGGREGATES('0RelProject00000000045',$,$,$,#1,(#42));
#46=IFCRELAGGREGATES('0RelBuilding0000000046',$,$,$,#42,(#41));
#50=IFCLOCALPLACEMENT($,#51);
#51=IFCAXIS2PLACEMENT3D(#52,$,$);
#52=IFCCARTESIANPOINT((0.,0.,${ancestorPointElevation}.));
${withGeoref ? `#30=IFCPROJECTEDCRS('EPSG:2056','Projected','Datum','LN02',$,$,#21);
#31=IFCMAPCONVERSION(#10,#30,2600000.,1200000.,${orthogonalHeight}.,1.,0.,1.);` : ''}
ENDSEC;
END-ISO-10303-21;
`;
}

async function parse(text: string): Promise<IfcDataStore> {
  const bytes = new TextEncoder().encode(text);
  return new IfcParser().parseColumnar(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
}

function model(
  id: string,
  store: IfcDataStore,
  idOffset: number,
  loadedAt: number,
  rtcZ = 0,
): FederatedModel {
  return {
    id,
    name: id,
    ifcDataStore: store,
    geometryResult: {
      meshes: [],
      totalTriangles: 0,
      totalVertices: 0,
      coordinateInfo: {
        originShift: { x: 0, y: 125, z: 0 },
        originalBounds: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 1, y: 1, z: 1 },
        },
        shiftedBounds: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 1, y: 1, z: 1 },
        },
        hasLargeCoordinates: rtcZ !== 0,
        wasmRtcOffset: { x: 0, y: 0, z: rtcZ },
      },
    },
    visible: true,
    collapsed: false,
    schemaVersion: 'IFC4',
    fileSize: 0,
    idOffset,
    maxExpressId: 52,
    loadedAt,
  };
}

function elevationRow(container: HTMLElement): string {
  const row = [...container.querySelectorAll('div')].find(
    (candidate) => candidate.querySelector(':scope > span')?.textContent?.trim() === 'Elevation',
  );
  assert.ok(row, `missing Structure/Elevation row in: ${container.textContent}`);
  const cells = row.querySelectorAll(':scope > span');
  assert.equal(cells.length, 2, 'Elevation row shape changed');
  return cells[1].textContent?.trim() ?? '';
}

let initialState: ReturnType<typeof useViewerStore.getState>;

before(() => {
  initialState = useViewerStore.getState();
});

afterEach(() => {
  cleanup();
  useViewerStore.setState(initialState, true);
});

describe('PropertiesPanel storey elevation (#4843)', () => {
  it('composes ancestor placements before MapConversion but never RTC/origin shifts', async () => {
    // Standard exporter shape: the storey placement is relative to the
    // building placement. The hierarchy intentionally keeps only the 3 m
    // storey-relative fallback; the Inspector must show 500 + 10 + 3.
    const store = await parse(source({
      elevation: 3,
      ancestorElevation: 10,
      orthogonalHeight: 500,
    }));
    const selectedModel = model('metres', store, 1_000_000, 1, 12_345);
    useViewerStore.setState({
      models: new Map([['metres', selectedModel]]),
      activeModelId: 'metres',
      selectedEntity: { modelId: 'metres', expressId: STOREY_ID },
      selectedEntityId: 1_000_000 + STOREY_ID,
    });

    assert.equal(store.spatialHierarchy?.storeyElevations.get(STOREY_ID), 3);
    assert.equal(elevationRow(render(<PropertiesPanel />)), '513.00 m');
    assert.equal(
      store.spatialHierarchy?.storeyElevations.get(STOREY_ID),
      3,
      'display conversion must not mutate the relative hierarchy elevation',
    );
  });

  it('uses the selected federated model and converts millimetre map heights to metres', async () => {
    const anchorStore = await parse(source({ elevation: 2, orthogonalHeight: 100 }));
    const selectedStore = await parse(source({
      elevation: 3,
      orthogonalHeight: 500_000,
      unitPrefix: '.MILLI.',
    }));
    const anchor = model('anchor', anchorStore, 1_000_000, 1);
    const selected = model('selected', selectedStore, 2_000_000, 2, 999_999);
    useViewerStore.setState({
      models: new Map([['anchor', anchor], ['selected', selected]]),
      activeModelId: 'selected',
      selectedEntity: { modelId: 'selected', expressId: STOREY_ID },
      selectedEntityId: 2_000_000 + STOREY_ID,
    });

    assert.equal(selectedStore.spatialHierarchy?.storeyElevations.get(STOREY_ID), 3);
    assert.equal(elevationRow(render(<PropertiesPanel />)), '503.00 m');
  });

  it('keeps the relative elevation for a model without a projected georeference', async () => {
    const store = await parse(source({ elevation: 3, orthogonalHeight: 0, withGeoref: false }));
    const selectedModel = model('local', store, 1_000_000, 1);
    useViewerStore.setState({
      models: new Map([['local', selectedModel]]),
      activeModelId: 'local',
      selectedEntity: { modelId: 'local', expressId: STOREY_ID },
      selectedEntityId: 1_000_000 + STOREY_ID,
    });

    assert.equal(elevationRow(render(<PropertiesPanel />)), '3.00 m');
  });
});
