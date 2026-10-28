import { describe, expect, test } from 'vitest';

import { MemoryMemento } from '..';

describe('memento', () => {
  test('memory', () => {
    const memento = new MemoryMemento();

    expect(memento.get('foo')).toBeUndefined();
    memento.set('foo', 'bar');
    expect(memento.get('foo')).toEqual('bar');

    let subscribed = null;
    const subscription = memento.watch('foo').subscribe(v => {
      subscribed = v;
    });
    expect(subscribed).toEqual('bar');
    memento.set('foo', 'baz');
    expect(subscribed).toEqual('baz');

    subscription.unsubscribe();
    memento.set('foo', 'hello');
    expect(subscribed).toEqual('baz');
  });

  test('setAll makes existing key values visible before notifying observers', () => {
    const memento = new MemoryMemento();
    memento.setAll({ a: 'old-a', b: 'old-b' });
    let observedB: string | undefined;
    memento.watch('a').subscribe(value => {
      if (value === 'new-a') {
        observedB = memento.get('b');
      }
    });

    memento.setAll({ a: 'new-a', b: 'new-b' });

    expect(observedB).toBe('new-b');
  });

  test('setAll skips a later key replaced by an observer', () => {
    const memento = new MemoryMemento();
    memento.setAll({ a: 'old-a', b: 'old-b' });
    const observedB: string[] = [];
    let stagedB: string | undefined;
    memento.watch<string>('b').subscribe(value => {
      if (value !== undefined) {
        observedB.push(value);
      }
    });
    memento.watch<string>('a').subscribe(value => {
      if (value === 'new-a') {
        stagedB = memento.get('b');
        memento.set('b', 'override');
      }
    });

    memento.setAll({ a: 'new-a', b: 'new-b' });

    expect(stagedB).toBe('new-b');
    expect(observedB).toEqual(['old-b', 'override']);
    expect(memento.get('b')).toBe('override');
  });
});
