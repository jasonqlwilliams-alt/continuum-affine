import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { DocStoragePool } from '@affine/native';
import { parseUniversalId } from '@affine/nbstore';
import type { NativeDBApis } from '@affine/nbstore/sqlite';
import fs from 'fs-extra';

import { getSpaceDBPath } from '../workspace/meta';

const POOL = new DocStoragePool();

export function getDocStoragePool() {
  return POOL;
}

type PoolLike = Pick<DocStoragePool, keyof NativeDBApis | 'setSpaceId'>;

interface ConnectionState {
  leases: Set<string>;
  connected: boolean;
  pending: number;
  queue: Promise<void>;
}

export function createNbstoreHandlers(
  pool: PoolLike = POOL,
  resolveSpaceDBPath: typeof getSpaceDBPath = getSpaceDBPath,
  ensureDir: (dir: string) => Promise<void> = dir => fs.ensureDir(dir)
): Omit<NativeDBApis, 'connect'> & {
  connect(universalId: string): Promise<string>;
  forceDisconnect(universalId: string): Promise<void>;
} {
  const connections = new Map<string, ConnectionState>();

  const getState = (universalId: string): ConnectionState => {
    let state = connections.get(universalId);
    if (!state) {
      state = {
        leases: new Set(),
        connected: false,
        pending: 0,
        queue: Promise.resolve(),
      };
      connections.set(universalId, state);
    }
    return state;
  };

  const enqueue = <T>(
    universalId: string,
    state: ConnectionState,
    task: () => Promise<T>
  ): Promise<T> => {
    state.pending += 1;
    const next = state.queue.then(task, task);
    state.queue = next.then(
      () => {
        state.pending -= 1;
        if (state.pending === 0 && !state.connected) {
          connections.delete(universalId);
        }
      },
      () => {
        state.pending -= 1;
        if (state.pending === 0 && !state.connected) {
          connections.delete(universalId);
        }
      }
    );
    return next;
  };

  return {
    connect: (universalId: string) => {
      const state = getState(universalId);
      return enqueue(universalId, state, async () => {
        if (!state.connected) {
          const { peer, type, id } = parseUniversalId(universalId);
          const dbPath = await resolveSpaceDBPath(peer, type, id);
          await ensureDir(path.dirname(dbPath));
          await pool.connect(universalId, dbPath);
          await pool.setSpaceId(universalId, id);
          state.connected = true;
        }
        const lease = randomUUID();
        state.leases.add(lease);
        return lease;
      });
    },
    disconnect: (universalId: string, lease?: string) => {
      if (!lease) {
        return Promise.resolve();
      }
      const state = connections.get(universalId);
      if (!state) {
        return Promise.resolve();
      }
      return enqueue(universalId, state, async () => {
        if (
          state.leases.delete(lease) &&
          state.leases.size === 0 &&
          state.connected
        ) {
          await pool.disconnect(universalId);
          state.connected = false;
        }
      });
    },
    forceDisconnect: (universalId: string) => {
      const state = getState(universalId);
      return enqueue(universalId, state, async () => {
        await pool.disconnect(universalId);
        state.connected = false;
        state.leases.clear();
      });
    },
    pushUpdate: pool.pushUpdate.bind(pool),
    getDoc: pool.getDoc.bind(pool),
    deleteDoc: pool.deleteDoc.bind(pool),
    getDocClocks: pool.getDocClocks.bind(pool),
    getDocClock: pool.getDocClock.bind(pool),
    getDocIndexedClock: pool.getDocIndexedClock.bind(pool),
    setDocIndexedClock: pool.setDocIndexedClock.bind(pool),
    clearDocIndexedClock: pool.clearDocIndexedClock.bind(pool),
    getBlob: pool.getBlob.bind(pool),
    setBlob: pool.setBlob.bind(pool),
    deleteBlob: pool.deleteBlob.bind(pool),
    releaseBlobs: pool.releaseBlobs.bind(pool),
    listBlobs: pool.listBlobs.bind(pool),
    getPeerRemoteClocks: pool.getPeerRemoteClocks.bind(pool),
    getPeerRemoteClock: pool.getPeerRemoteClock.bind(pool),
    setPeerRemoteClock: pool.setPeerRemoteClock.bind(pool),
    getPeerPulledRemoteClocks: pool.getPeerPulledRemoteClocks.bind(pool),
    getPeerPulledRemoteClock: pool.getPeerPulledRemoteClock.bind(pool),
    setPeerPulledRemoteClock: pool.setPeerPulledRemoteClock.bind(pool),
    getPeerPushedClocks: pool.getPeerPushedClocks.bind(pool),
    getPeerPushedClock: pool.getPeerPushedClock.bind(pool),
    setPeerPushedClock: pool.setPeerPushedClock.bind(pool),
    clearClocks: pool.clearClocks.bind(pool),
    setBlobUploadedAt: pool.setBlobUploadedAt.bind(pool),
    getBlobUploadedAt: pool.getBlobUploadedAt.bind(pool),
    crawlDocData: pool.crawlDocData.bind(pool),
    setDocIndexedClocks: pool.setDocIndexedClocks.bind(pool),
    indexUpsert: pool.indexUpsert.bind(pool),
    indexDelete: pool.indexDelete.bind(pool),
    indexSearch: pool.indexSearch.bind(pool),
    indexAggregate: pool.indexAggregate.bind(pool),
    indexDeleteByQuery: pool.indexDeleteByQuery.bind(pool),
    indexFlush: pool.indexFlush.bind(pool),
    indexVersion: pool.indexVersion.bind(pool),
  };
}

export const { forceDisconnect: forceDisconnectNbstore, ...nbstoreHandlers } =
  createNbstoreHandlers();
