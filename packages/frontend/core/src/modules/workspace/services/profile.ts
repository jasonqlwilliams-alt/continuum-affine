import { ObjectPool, Service } from '@toeverything/infra';

import { WorkspaceProfile } from '../entities/profile';
import { type WorkspaceMetadata, workspaceMetadataKey } from '../metadata';

export class WorkspaceProfileService extends Service {
  pool = new ObjectPool<string, WorkspaceProfile>();

  getProfile = (metadata: WorkspaceMetadata): WorkspaceProfile => {
    const poolKey = workspaceMetadataKey(metadata);
    const exists = this.pool.get(poolKey);
    if (exists) {
      return exists.obj;
    }

    const profile = this.framework.createEntity(WorkspaceProfile, {
      metadata,
    });

    return this.pool.put(poolKey, profile).obj;
  };
}
