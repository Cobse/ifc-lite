/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * meshForClash (#1959 P0 leak) creates a GeometryProcessor per call and never
 * disposed it — not on the happy path, and not on the `throw` it emits when
 * a model has no drawable geometry. That throw path is the one worth
 * covering: a `try { ... } finally { dispose() }` that only wraps the
 * success return would still leak on every schema-only model clashed
 * against.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import { readFile } from 'node:fs/promises';

import { GeometryProcessor, type GeometryResult } from '@ifc-lite/geometry';
import { ToolErrorCode } from '@ifc-lite/mcp/browser';
import { countStepEntities } from '@ifc-lite/export';
import type { Clash } from '@ifc-lite/clash';
import { dispatch, parsePlaygroundModel, topClashRows, type LoadedPlaygroundModel } from './playground-dispatcher.js';
import { playgroundFiles } from './playground-files.js';

function clashOf(distance: number, distanceKind: Clash['distanceKind']): Clash {
  return {
    id: 'c1',
    a: { model: 'm', key: 'a', ref: 1, tag: 'IfcSlab' },
    b: { model: 'm', key: 'b', ref: 2, tag: 'IfcSlab' },
    rule: 'r',
    status: 'hard',
    distance,
    distanceKind,
    point: [0, 0, 0],
    bounds: { min: [0, 0, 0], max: [1, 1, 1] },
    severity: 'major',
  };
}

describe('topClashRows distance provenance', () => {
  it('carries distanceKind through to the playground JSON row', () => {
    const { rows } = topClashRows([clashOf(-0.25, 'estimate')], 10);
    assert.equal((rows[0] as { distanceKind?: string }).distanceKind, 'estimate');
  });

  it('carries an absent distanceKind through as undefined, not silently as measured', () => {
    const { rows } = topClashRows([clashOf(-0.25, undefined)], 10);
    const row = rows[0] as { distanceKind?: string };
    assert.equal('distanceKind' in row, true);
    assert.equal(row.distanceKind, undefined);
  });
});

function ifc4(body: string): string {
  return [
    'ISO-10303-21;', 'HEADER;', "FILE_DESCRIPTION((''),'2;1');",
    "FILE_NAME('','',(''),(''),'','','');", "FILE_SCHEMA(('IFC4'));", 'ENDSEC;',
    'DATA;', body, 'ENDSEC;', 'END-ISO-10303-21;', '',
  ].join('\n');
}

/** A schema-only model (no geometry entity) — same shape meshForClash sees
 *  in production when a model carries no drawable geometry. Each call gets
 *  a unique GlobalId so its `id:fileSize` cache key never collides with a
 *  sibling test's — meshForClash's module-level LRU cache would otherwise
 *  serve a stale (or throw-skipped) result across `it()`s. */
async function schemaOnlyModel(globalId: string): Promise<LoadedPlaygroundModel> {
  const bytes = new TextEncoder().encode(
    ifc4(`#1=IFCWALL('${globalId}',$,'Wall A',$,$,$,$,$,.STANDARD.);`),
  );
  return parsePlaygroundModel(bytes.buffer as ArrayBuffer, `${globalId}.ifc`);
}

describe('meshForClash WASM disposal (#1959 P0 leak)', () => {
  it('disposes the GeometryProcessor handle when it throws UNSUPPORTED_OPERATION on empty meshes', async () => {
    const initMock = mock.method(GeometryProcessor.prototype, 'init', async () => undefined);
    const processMock = mock.method(GeometryProcessor.prototype, 'process', async () =>
      ({ meshes: [] }) as unknown as GeometryResult,
    );
    const disposeMock = mock.method(GeometryProcessor.prototype, 'dispose', () => undefined);
    try {
      const model = await schemaOnlyModel('0aBcDeFgHiJkLmNoPqRsT1');
      const result = await dispatch(model, 'clash_check', {});
      assert.equal(result.isError, true);
      assert.equal(result.errorCode, ToolErrorCode.UNSUPPORTED_OPERATION);
      assert.equal(disposeMock.mock.callCount(), 1, 'dispose runs exactly once even though meshForClash threw');
    } finally {
      initMock.mock.restore();
      processMock.mock.restore();
      disposeMock.mock.restore();
    }
  });

  it('disposes the GeometryProcessor handle on the success path too', async () => {
    const oneTriangle = {
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 2]),
      color: [1, 1, 1, 1] as [number, number, number, number],
      expressId: 1,
    };
    const initMock = mock.method(GeometryProcessor.prototype, 'init', async () => undefined);
    const processMock = mock.method(GeometryProcessor.prototype, 'process', async () =>
      ({ meshes: [oneTriangle] }) as unknown as GeometryResult,
    );
    const disposeMock = mock.method(GeometryProcessor.prototype, 'dispose', () => undefined);
    try {
      const model = await schemaOnlyModel('0aBcDeFgHiJkLmNoPqRsT2');
      const result = await dispatch(model, 'clash_check', {});
      assert.equal(result.isError, false);
      assert.equal(disposeMock.mock.callCount(), 1, 'dispose runs exactly once on the success path');
    } finally {
      initMock.mock.restore();
      processMock.mock.restore();
      disposeMock.mock.restore();
    }
  });
});

describe('count_entities group_by:type universe (#3765)', () => {
  it('counts BIM products, not every raw STEP record (owner history, pset, property included)', async () => {
    // One wall, plus non-product STEP records (owner history, a property set
    // and its single property) that `m.store.entityIndex.byType` would still
    // fold in. `query_entities`/`get_entity`/the Node MCP server's own
    // count_entities only ever mean "BIM product" — this branch used to
    // report the raw-STEP total instead, disagreeing with all of those for
    // the same model.
    const bytes = new TextEncoder().encode(
      ifc4([
        "#1=IFCOWNERHISTORY($,$,$,$,$,$,$,0);",
        "#10=IFCWALL('0aBcDeFgHiJkLmNoPqRsT3',#1,'Wall A',$,$,$,$,$,.STANDARD.);",
        "#20=IFCPROPERTYSINGLEVALUE('FireRating',$,'REI60',$);",
        "#30=IFCPROPERTYSET('psetguid00000000000001',#1,'Pset_WallCommon',$,(#20));",
        "#40=IFCRELDEFINESBYPROPERTIES('relguid0000000000000001',#1,$,$,(#10),#30);",
      ].join('\n')),
    );
    const model = await parsePlaygroundModel(bytes.buffer as ArrayBuffer, 'wall-with-pset.ifc');
    const result = await dispatch(model, 'count_entities', { group_by: 'type' });
    assert.equal(result.isError, false);
    const structured = result.structured as { groups: Array<{ key: string; count: number }> };
    const total = structured.groups.reduce((s, g) => s + g.count, 0);
    assert.equal(total, 1, 'only the wall is a BIM product; owner history/pset/property are not');
    assert.deepEqual(structured.groups, [{ key: 'IfcWall', count: 1 }]);
  });

  it('applies args.type before grouping, like the Node MCP server', async () => {
    // A wall and a door: `type: 'IfcDoor'` must count only the door, and a
    // non-matching type must count nothing rather than fall back to every
    // product (the branch used to ignore `type` entirely).
    const bytes = new TextEncoder().encode(
      ifc4([
        "#1=IFCOWNERHISTORY($,$,$,$,$,$,$,0);",
        "#10=IFCWALL('0aBcDeFgHiJkLmNoPqRsT3',#1,'Wall A',$,$,$,$,$,.STANDARD.);",
        "#11=IFCDOOR('0aBcDeFgHiJkLmNoPqRsT4',#1,'Door A',$,$,$,$,$,$,$,$,$,$);",
      ].join('\n')),
    );
    const model = await parsePlaygroundModel(bytes.buffer as ArrayBuffer, 'wall-and-door.ifc');
    const door = await dispatch(model, 'count_entities', { group_by: 'type', type: 'IfcDoor' });
    assert.equal(door.isError, false);
    assert.deepEqual((door.structured as { groups: unknown }).groups, [{ key: 'IfcDoor', count: 1 }]);
    const none = await dispatch(model, 'count_entities', { group_by: 'type', type: 'IfcWindow' });
    assert.equal(none.isError, false);
    assert.deepEqual((none.structured as { groups: unknown }).groups, []);
  });
});

/**
 * #4738: `export_ifc` here is the playground twin of the stdio MCP tool, and
 * it was the one caller of `bim.export.ifc()` with NO zero-match guard of its
 * own. `global_ids` that matched nothing left `refs` empty, and an empty array
 * was the SDK binding's "no filter, export the whole model" signal — so the
 * tool staged the entire model as a download and reported it as the requested
 * subset ("N entities" is read from `m.store.entityCount` when `refs` is
 * empty). The whole-model control below is what makes that a defect rather
 * than a preference: the two calls produced the same bytes.
 *
 * The fix moved the distinction into the argument at the shared home
 * (`ExportNamespace.ifc`): no `global_ids` omits the ref list, an allowlist
 * that matched nothing stays an empty array, and an empty array is refused.
 */
describe('playground export_ifc with global_ids that match nothing (#4738)', () => {
  async function helloWall(): Promise<LoadedPlaygroundModel> {
    const path = new URL('../../../public/samples/hello-wall.ifc', import.meta.url);
    const bytes = new Uint8Array(await readFile(path));
    return parsePlaygroundModel(bytes.buffer as ArrayBuffer, 'hello-wall.ifc');
  }

  it('refuses instead of staging the whole model as the download', async () => {
    const model = await helloWall();

    // The control runs first, so "refuses" below cannot pass because the
    // exporter is broken: with no allowlist the tool still stages every entity.
    const whole = await dispatch(model, 'export_ifc', {});
    assert.equal(whole.isError, false);
    const wholeEntities = countStepEntities(new Uint8Array(await playgroundFiles.list()[0].blob.arrayBuffer()));
    assert.ok(wholeEntities > 1, `expected a multi-entity export, got ${wholeEntities}`);

    const stagedBefore = playgroundFiles.list().length;
    const zero = await dispatch(model, 'export_ifc', { global_ids: ['0NoSuchGlobalIdHere12'] });

    // RED before the fix: `isError` was false and the newly staged blob held
    // all `wholeEntities` instances — the same bytes as the control above.
    if (!zero.isError) {
      const wrote = countStepEntities(new Uint8Array(await playgroundFiles.list()[0].blob.arrayBuffer()));
      assert.ok(wrote < wholeEntities, `zero-match export wrote ${wrote} of ${wholeEntities} entities`);
    }
    assert.equal(zero.isError, true);
    // The stdio tool's code and wording, not the SDK's message: a client that
    // branches on `errorCode` must not read bad input as a server fault.
    assert.equal(zero.errorCode, ToolErrorCode.ENTITY_NOT_FOUND);
    assert.match(zero.text, /No entity matches any of the 1 requested global_ids/);
    // Nothing reached the Downloads panel, so the user cannot save it either.
    assert.equal(playgroundFiles.list().length, stagedBefore);
  });
});
