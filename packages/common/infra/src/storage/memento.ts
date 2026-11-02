import type { Observable } from 'rxjs';

import { LiveData } from '../livedata';

/**
 * A memento represents a storage utility. It can store and retrieve values, and observe changes.
 */
export interface Memento {
  get<T>(key: string): T | undefined;
  watch<T>(key: string): Observable<T | undefined>;
  set<T>(key: string, value: T | undefined): void;
  del(key: string): void;
  clear(): void;
  keys(): string[];
}

/**
 * A simple implementation of Memento. Used for testing.
 */
export class MemoryMemento implements Memento {
  private readonly data = new Map<string, LiveData<any>>();
  private readonly pendingBatches: Map<string, any>[] = [];

  setAll(init: Record<string, any>) {
    const entries = Object.entries(init);
    const pending = new Map(entries);
    this.pendingBatches.push(pending);
    try {
      for (const [key, value] of entries) {
        if (pending.has(key)) {
          this.invalidatePending(key);
          this.getLiveData(key).next(value);
        }
      }
    } finally {
      this.pendingBatches.pop();
    }
  }

  private invalidatePending(key: string) {
    for (const batch of this.pendingBatches) {
      batch.delete(key);
    }
  }

  private getLiveData(key: string): LiveData<any> {
    let data$ = this.data.get(key);
    if (!data$) {
      data$ = new LiveData<any>(undefined);
      this.data.set(key, data$);
    }
    return data$;
  }

  get<T>(key: string): T | undefined {
    for (let i = this.pendingBatches.length - 1; i >= 0; i--) {
      const batch = this.pendingBatches[i];
      if (batch && batch.has(key)) {
        return batch.get(key);
      }
    }
    return this.getLiveData(key).value;
  }
  watch<T>(key: string): Observable<T | undefined> {
    return this.getLiveData(key).asObservable();
  }
  set<T>(key: string, value: T): void {
    this.invalidatePending(key);
    this.getLiveData(key).next(value);
  }
  keys(): string[] {
    return Array.from(this.data)
      .filter(([_, data$]) => data$.value !== undefined)
      .map(([key]) => key);
  }
  clear(): void {
    this.data.clear();
    for (const batch of this.pendingBatches) {
      batch.clear();
    }
  }
  del(key: string): void {
    this.data.delete(key);
    this.invalidatePending(key);
  }
}

export function wrapMemento(memento: Memento, prefix: string): Memento {
  return {
    get<T>(key: string): T | undefined {
      return memento.get(prefix + key);
    },
    watch(key: string) {
      return memento.watch(prefix + key);
    },
    set<T>(key: string, value: T): void {
      memento.set(prefix + key, value);
    },
    keys(): string[] {
      return memento
        .keys()
        .filter(k => k.startsWith(prefix))
        .map(k => k.slice(prefix.length));
    },
    clear() {
      memento.keys().forEach(k => {
        if (k.startsWith(prefix)) {
          memento.del(k);
        }
      });
    },
    del(key: string): void {
      memento.del(prefix + key);
    },
  };
}
