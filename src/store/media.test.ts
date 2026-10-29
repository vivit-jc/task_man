import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './useAppStore';
import { makeMediaItem } from './persist';
import type { MediaItem } from '../types';

function load(items: MediaItem[]): void {
  useAppStore.setState({ media: items, undoStack: [] });
}

function titles(status: MediaItem['status']): string[] {
  return useAppStore
    .getState()
    .media.filter((m) => m.status === status)
    .sort((a, b) => a.order - b.order)
    .map((m) => m.title);
}

describe('たのしみの並べ替え', () => {
  beforeEach(() => {
    load([
      makeMediaItem({ id: 'a', title: 'A', order: 0 }),
      makeMediaItem({ id: 'b', title: 'B', order: 1 }),
      makeMediaItem({ id: 'c', title: 'C', order: 2 }),
      makeMediaItem({ id: 'p', title: 'P', status: 'playing', order: 0 }),
    ]);
  });

  it('同じ列の中で、相手のカードの後ろへ動かせる', () => {
    useAppStore.getState().moveMedia('a', 'want', { anchorId: 'c', after: true });
    expect(titles('want')).toEqual(['B', 'C', 'A']);
  });

  it('同じ列の中で、相手のカードの前へ動かせる', () => {
    useAppStore.getState().moveMedia('c', 'want', { anchorId: 'a', after: false });
    expect(titles('want')).toEqual(['C', 'A', 'B']);
  });

  it('別の列に落とすと状態が変わり、開始日が入る', () => {
    useAppStore.getState().moveMedia('b', 'playing', { anchorId: 'p', after: false });
    expect(titles('want')).toEqual(['A', 'C']);
    expect(titles('playing')).toEqual(['B', 'P']);
    const moved = useAppStore.getState().media.find((m) => m.id === 'b')!;
    expect(moved.status).toBe('playing');
    expect(moved.startedAt).not.toBeNull();
  });

  it('列の空いているところに落とすと末尾に入る', () => {
    useAppStore.getState().moveMedia('a', 'playing', Number.MAX_SAFE_INTEGER);
    expect(titles('playing')).toEqual(['P', 'A']);
  });

  it('ボタンで状態を変えたものは移った先の先頭に入る', () => {
    useAppStore.getState().setMediaStatus('c', 'playing');
    expect(titles('playing')).toEqual(['C', 'P']);
  });

  it('追加したものは気になるの先頭に入る', () => {
    useAppStore.getState().addMedia({ title: 'New', kindId: null });
    expect(titles('want')).toEqual(['New', 'A', 'B', 'C']);
  });

  it('済にした日は最初の 1 回だけ記録する', () => {
    load([makeMediaItem({ id: 'x', title: 'X', status: 'done', finishedAt: '2026-01-01' })]);
    useAppStore.getState().moveMedia('x', 'playing', 0);
    useAppStore.getState().moveMedia('x', 'done', 0);
    expect(useAppStore.getState().media[0]?.finishedAt).toBe('2026-01-01');
  });
});
