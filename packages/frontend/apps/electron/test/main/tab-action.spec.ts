import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {},
  BrowserWindow: class {},
  Menu: class {},
  MenuItem: class {},
  WebContentsView: class {},
}));

vi.mock('@affine/i18n', () => ({ I18n: {} }));

vi.mock('../../src/main/windows-manager/main-window', async () => {
  const { BehaviorSubject } = await import('rxjs');
  return {
    MainWindowManager: {
      instance: { mainWindow$: new BehaviorSubject(undefined) },
    },
    getMainWindow: () => undefined,
  };
});

vi.mock('../../src/main/shared-storage/storage', async () => {
  const { BehaviorSubject } = await import('rxjs');
  return {
    globalStateStorage: {
      get: () => undefined,
      watch: () => new BehaviorSubject(undefined),
      set: () => undefined,
    },
  };
});

vi.mock('../../src/main/shared-state-schema', () => ({
  SpellCheckStateKey: 'spell-check',
  SpellCheckStateSchema: { parse: () => ({}) },
  TabViewsMetaKey: 'tabs',
  tabViewsMetaSchema: {
    parse: () => ({ activeWorkbenchId: 'tab-1', workbenches: [] }),
  },
}));

vi.mock('../../src/main/cleanup', () => ({
  beforeAppQuit: () => undefined,
  onTabClose: () => undefined,
}));

vi.mock('../../src/main/helper-process', () => ({
  ensureHelperProcess: () => undefined,
}));

vi.mock('../../src/main/logger', () => ({
  logger: { error: () => undefined },
}));

vi.mock('../../src/main/web-preferences', () => ({
  buildWebPreferences: () => ({}),
}));

vi.mock('../../src/shared/internal-origin', () => ({
  mainWindowOrigin: '',
  shellViewUrl: '',
}));

vi.mock('../../src/shared/utils', () => ({ isMacOS: () => false }));

import {
  onTabAction,
  WebContentViewsManager,
} from '../../src/main/windows-manager/tab-views';

describe('tab action subscription', () => {
  it('stops delivering actions after unsubscribe without silencing another subscriber', () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = onTabAction(first);
    const stopSecond = onTabAction(second);
    const action = { type: 'close-tab' } as const;

    WebContentViewsManager.instance.tabAction$.next(action);
    stopFirst();
    WebContentViewsManager.instance.tabAction$.next(action);
    stopSecond();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });
});
