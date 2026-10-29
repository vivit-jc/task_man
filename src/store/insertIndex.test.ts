import { describe, expect, it } from 'vitest';
import { makeTask } from './persist';
import { insertIndex } from './useAppStore';

const ids = ['a', 'done', 'b', 'c'];
const siblings = ids.map((id, order) => makeTask({ id, title: id, stage: 'soon', parentId: null, order }));

describe('ドロップ位置の解決', () => {
  it('カードの前に落とすとそのカードの位置に入る', () => {
    expect(insertIndex(siblings, { anchorId: 'b', after: false })).toBe(2);
  });

  it('カードの後に落とすと次の位置に入る', () => {
    expect(insertIndex(siblings, { anchorId: 'b', after: true })).toBe(3);
  });

  it('画面に出ていない完了済みが間にあっても、狙ったカードの隣に入る', () => {
    // 画面上は a, b, c の並びで b は 1 番目だが、全体では 2 番目
    expect(siblings[insertIndex(siblings, { anchorId: 'b', after: false })]?.id).toBe('b');
  });

  it('見つからないカードを指定したら末尾に入る', () => {
    expect(insertIndex(siblings, { anchorId: 'missing', after: false })).toBe(4);
  });

  it('番号指定は範囲内に収める', () => {
    expect(insertIndex(siblings, -5)).toBe(0);
    expect(insertIndex(siblings, Number.MAX_SAFE_INTEGER)).toBe(4);
  });
});
