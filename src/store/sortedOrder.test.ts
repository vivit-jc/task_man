import { describe, expect, it } from 'vitest';
import { useAppStore } from './useAppStore';
import { makeTask } from './persist';

function setup() {
  useAppStore.setState({
    tasks: [
      makeTask({ id: 'a', title: 'a', stage: 'now', order: 0 }),
      makeTask({ id: 'b', title: 'b', stage: 'now', order: 1 }),
      makeTask({ id: 'h', title: 'h', stage: 'now', order: 2, priority: 'high' }),
    ],
    ui: { ...useAppStore.getState().ui, sortKey: 'priority' },
  });
}

function nowOrder() {
  return useAppStore
    .getState()
    .tasks.filter((t) => t.stage === 'now')
    .sort((x, y) => x.order - y.order)
    .map((t) => t.id);
}

describe('並べ替え中のドラッグ', () => {
  it('優先度順で先頭に落としたら、見えている先頭に入る', () => {
    setup();
    // 画面の並びは h, a, b。b を h の前（先頭）へ
    expect(useAppStore.getState().adoptSortedOrder()).toBe(true);
    useAppStore.getState().moveTask('b', { kind: 'stage', stage: 'now' }, { anchorId: 'h', after: false });
    expect(nowOrder()).toEqual(['b', 'h', 'a']);
    expect(useAppStore.getState().ui.sortKey).toBe('manual');
  });

  it('手動の並びなら何もしない', () => {
    setup();
    useAppStore.setState({ ui: { ...useAppStore.getState().ui, sortKey: 'manual' } });
    expect(useAppStore.getState().adoptSortedOrder()).toBe(false);
    expect(nowOrder()).toEqual(['a', 'b', 'h']);
  });
});
