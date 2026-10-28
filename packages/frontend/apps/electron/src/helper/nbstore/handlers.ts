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
  refCount: number;
  connected: boolean;
  queue: Promise<void>;
}

export function createNbstoreHandlers(
  pool: PoolLike = POOL,
  resolveSpaceDBPath: typeof getSpaceDBPath = getSpaceDBPath,
  ensureDir: (dir: string) => Promise<void> = dir => fs.ensureDir(dir)
): NativeDBApis {
  const connections = new Map<string, ConnectionState>();

  const getState = (universalId: string): ConnectionState => {
    let state = connections.get(universalId);
    if (!state) {
      state = {
        refCount: 0,
        connected: false,
        queue: Promise.resolve(),
      };
      connections.set(universalId, state);
    }
    return state;
  };

  const enqueue = <T>(
    state: ConnectionState,
    task: () => Promise<T>
  ): Promise<T> => {
    const next = state.queue.then(task, task);
    state.queue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };

  return {
    connect: (universalId: string) => {
      const state = getState(universalId);
      return enqueue(state, async () => {
        if (!state.connected) {
          const { peer, type, id } = parseUniversalId(universalId);
          const dbPath = await resolveSpaceDBPath(peer, type, id);
          await ensureDir(path.dirname(dbPath));
          await pool.connect(universalId, dbPath);
          await pool.setSpaceId(universalId, id);
          state.connected = true;
        }
        state.refCount += 1;
      });
    },
    disconnect: (universalId: string) => {
      const state = connections.get(universalId);
      if (!state) {
        return Promise.resolve();
      }
      return enqueue(state, async () => {
        if (state.refCount > 0) {
          state.refCount -= 1;
        }
        if (state.refCount === 0 && state.connected) {
          await pool.disconnect(universalId);
          state.connected = false;
          connections.delete(universalId);
        }
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

export const nbstoreHandlers: NativeDBApis = createNbstoreHandlers();
