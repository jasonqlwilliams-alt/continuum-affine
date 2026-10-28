import { universalId } from '@affine/nbstore';
import { ObjectPool } from '@toeverything/infra';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@affine/native', () => ({
  DocStoragePool: class {
    constructor() {
      return new Proxy(
        {},
        {
          get: () => () => undefined,
        }
      );
    }
  },
}));

vi.mock('../../src/helper/main-rpc', () => ({
  mainRPC: {
    getPath: async () => '/tmp/app-data',
  },
}));

import { MemoryMemento } from '../../../../../common/infra/src/storage/memento';
import { workspaceMetadataKey } from '../../../../core/src/modules/workspace/metadata';
import { createNbstoreHandlers } from '../../src/helper/nbstore/handlers';

function createSimulatedNativePool() {
  const states = new Map<string, 'connecting' | 'connected'>();
  const spaceIds = new Map<string, string>();
  const counts = {
    connect: 0,
    setSpaceId: 0,
    disconnect: 0,
    getDoc: 0,
  };

  let releaseConnectGate: (() => void) | null = null;
  const connectGate = new Promise<void>(resolve => {
    releaseConnectGate = resolve;
  });

  const pool: any = new Proxy(
    {
      connect: async (universalId: string, _dbPath: string) => {
        counts.connect += 1;
        const current = states.get(universalId);
        if (current === 'connecting') {
          throw new Error('Connection in progress');
        }
        if (current === 'connected') {
          return;
        }
        states.set(universalId, 'connecting');
        await connectGate;
        states.set(universalId, 'connected');
      },
      setSpaceId: async (universalId: string, spaceId: string) => {
        counts.setSpaceId += 1;
        if (states.get(universalId) !== 'connected') {
          throw new Error('Storage not found');
        }
        spaceIds.set(universalId, spaceId);
      },
      disconnect: async (universalId: string) => {
        counts.disconnect += 1;
        states.delete(universalId);
        spaceIds.delete(universalId);
      },
      getDoc: async (universalId: string, docId: string) => {
        counts.getDoc += 1;
        if (states.get(universalId) !== 'connected') {
          throw new Error('Storage not found');
        }
        return {
          docId,
          bin: new Uint8Array([1, 2, 3]),
          timestamp: new Date('2026-01-01T00:00:00.000Z'),
        };
      },
    },
    {
      get(target, prop) {
        if (prop in target) {
          return target[prop as keyof typeof target];
        }
        return async () => undefined;
      },
    }
  );

  return {
    pool,
    counts,
    states,
    spaceIds,
    unblockConnect: () => releaseConnectGate?.(),
  };
}

describe('nbstore helper handlers and desktop recovery guards', () => {
  it('coalesces concurrent connect calls for the same universalId without throwing Connection in progress', async () => {
    const sim = createSimulatedNativePool();
    const handlers = createNbstoreHandlers(
      sim.pool,
      async (peer, type, id) =>
        `/tmp/workspaces/${peer}/${type}/${id}/storage.db`,
      async () => undefined
    );

    const targetUniversalId = universalId({
      peer: 'affine-cloud',
      type: 'workspace',
      id: '00000000-0000-0000-0000-000000000001',
    });

    // Simulate background-worker and tab WebContentsView connecting simultaneously.
    const workerConnect = handlers.connect(targetUniversalId);
    const tabProfileConnect = handlers.connect(targetUniversalId);

    sim.unblockConnect();
    await Promise.all([workerConnect, tabProfileConnect]);

    expect(sim.counts.connect).toBe(1);
    expect(sim.counts.setSpaceId).toBe(1);
    expect(sim.states.get(targetUniversalId)).toBe('connected');
    expect(sim.spaceIds.get(targetUniversalId)).toBe(
      '00000000-0000-0000-0000-000000000001'
    );
  });

  it('keeps the native pool connected until all callers release their reference', async () => {
    const sim = createSimulatedNativePool();
    sim.unblockConnect();

    const handlers = createNbstoreHandlers(
      sim.pool,
      async (peer, type, id) =>
        `/tmp/workspaces/${peer}/${type}/${id}/storage.db`,
      async () => undefined
    );

    const targetUniversalId = universalId({
      peer: 'affine-cloud',
      type: 'workspace',
      id: '00000000-0000-0000-0000-000000000001',
    });

    // 1. background-worker WorkspaceEngine connects
    const workerLease = await handlers.connect(targetUniversalId);
    // 2. tab WebContentsView getWorkspaceProfile connects, reads root doc, and disconnects
    const tabLease = await handlers.connect(targetUniversalId);
    const snap = await handlers.getDoc(
      targetUniversalId,
      '00000000-0000-0000-0000-000000000001'
    );
    expect(snap?.docId).toBe('00000000-0000-0000-0000-000000000001');
    await handlers.disconnect(targetUniversalId, tabLease);

    // Pool must remain connected for background-worker WorkspaceEngine
    expect(sim.counts.disconnect).toBe(0);
    expect(sim.states.get(targetUniversalId)).toBe('connected');

    const workerRead = await handlers.getDoc(targetUniversalId, 'doc-1');
    expect(workerRead?.docId).toBe('doc-1');

    // 3. background-worker disconnects on workspace close
    await handlers.disconnect(targetUniversalId, workerLease);
    expect(sim.counts.disconnect).toBe(1);
    expect(sim.states.has(targetUniversalId)).toBe(false);
  });

  it('tracks a connect queued after the final disconnect', async () => {
    const sim = createSimulatedNativePool();
    sim.unblockConnect();
    const handlers = createNbstoreHandlers(
      sim.pool,
      async () => '/tmp/workspaces/storage.db',
      async () => undefined
    );
    const id = universalId({
      peer: 'local',
      type: 'workspace',
      id: '00000000-0000-0000-0000-000000000001',
    });

    const firstLease = await handlers.connect(id);
    const firstDisconnect = handlers.disconnect(id, firstLease);
    const reconnect = handlers.connect(id);
    const [, reconnectLease] = await Promise.all([firstDisconnect, reconnect]);
    await handlers.disconnect(id, reconnectLease);

    expect(sim.counts.connect).toBe(2);
    expect(sim.counts.disconnect).toBe(2);
    expect(sim.states.has(id)).toBe(false);
  });

  it('invalidates a save-dialog lease after deletion without closing a reopened tab', async () => {
    const sim = createSimulatedNativePool();
    sim.unblockConnect();
    const handlers = createNbstoreHandlers(
      sim.pool,
      async () => '/tmp/workspaces/storage.db',
      async () => undefined
    );
    const id = universalId({
      peer: 'local',
      type: 'workspace',
      id: '00000000-0000-0000-0000-000000000001',
    });

    const saveDialogLease = await handlers.connect(id);
    await handlers.forceDisconnect(id);
    const tabLease = await handlers.connect(id);
    await handlers.disconnect(id, saveDialogLease);

    expect(sim.counts.disconnect).toBe(1);
    expect((await handlers.getDoc(id, 'doc-1'))?.docId).toBe('doc-1');

    await handlers.disconnect(id, tabLease);

    expect(sim.counts.connect).toBe(2);
    expect(sim.counts.disconnect).toBe(2);
    expect(sim.states.has(id)).toBe(false);
  });

  it('populates all keys in MemoryMemento.setAll before firing watched key notifications and scopes workspace pool keys by flavour', () => {
    const memento = new MemoryMemento();
    let observedCloudWorkspaces: unknown = null;

    // Watch affine-cloud-auth before setAll is invoked with affine-cloud-auth preceding cloud-workspace:<accountId>
    memento.watch('affine-cloud-auth').subscribe(val => {
      if (val) {
        observedCloudWorkspaces = memento.get('cloud-workspace:account-1');
      }
    });

    memento.setAll({
      'affine-cloud-auth': { id: 'account-1' },
      'cloud-workspace:account-1': [
        {
          id: '00000000-0000-0000-0000-000000000001',
          flavour: 'affine-cloud',
        },
      ],
    });

    expect(Array.isArray(observedCloudWorkspaces)).toBe(true);

    const pool = new ObjectPool<string, { flavour: string; id: string }>();
    const cloudMeta = {
      id: '00000000-0000-0000-0000-000000000001',
      flavour: 'affine-cloud',
    };
    const selfhostMeta = {
      id: '00000000-0000-0000-0000-000000000001',
      flavour: 'selfhost-1',
    };
    pool.put(workspaceMetadataKey(cloudMeta), cloudMeta);
    pool.put(workspaceMetadataKey(selfhostMeta), selfhostMeta);
    expect(pool.get(workspaceMetadataKey(cloudMeta))?.obj.flavour).toBe(
      'affine-cloud'
    );
    expect(pool.get(workspaceMetadataKey(selfhostMeta))?.obj.flavour).toBe(
      'selfhost-1'
    );
  });
});
