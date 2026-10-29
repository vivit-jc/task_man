import { describe, expect, it } from 'vitest';
import {
  ImportError,
  defaultAppData,
  isHhMm,
  makeEvent,
  makeMediaItem,
  normalizeMediaOrders,
  parseAppData,
} from './persist';
import { toExportJson } from './transfer';

describe('インポートの検証', () => {
  it('エクスポートしたものをそのまま読み戻せる', () => {
    const data = defaultAppData();
    const restored = parseAppData(JSON.parse(toExportJson(data)));
    expect(restored.tasks).toHaveLength(data.tasks.length);
    expect(restored.tasks[0]?.title).toBe(data.tasks[0]?.title);
    expect(restored.tags).toHaveLength(data.tags.length);
  });

  it('tasks が無いものは受け付けない', () => {
    expect(() => parseAppData({ hello: 'world' })).toThrow(ImportError);
    expect(() => parseAppData(null)).toThrow(ImportError);
  });

  it('欠けたフィールドは既定値で補う', () => {
    const restored = parseAppData({ tasks: [{ title: '最低限' }] });
    const task = restored.tasks[0]!;
    expect(task.stage).toBe('soon');
    expect(task.priority).toBe('normal');
    expect(task.done).toBe(false);
    expect(task.id).toBeTruthy();
  });

  it('親が居ないサブタスクはトップレベルに戻す', () => {
    const restored = parseAppData({
      tasks: [{ title: '孤児', parentId: 'missing' }],
    });
    expect(restored.tasks[0]?.parentId).toBeNull();
  });

  it('孫タスクは 1 段に引き上げる', () => {
    const restored = parseAppData({
      tasks: [
        { id: 'a', title: '親' },
        { id: 'b', title: '子', parentId: 'a' },
        { id: 'c', title: '孫', parentId: 'b' },
      ],
    });
    expect(restored.tasks.find((t) => t.id === 'c')?.parentId).toBe('a');
  });
});

describe('イベントの検証', () => {
  it('エクスポートしたイベントを読み戻せる', () => {
    const data = defaultAppData();
    const restored = parseAppData(JSON.parse(toExportJson(data)));
    expect(restored.events).toHaveLength(data.events.length);
    expect(restored.events[0]?.title).toBe(data.events[0]?.title);
    // タスクからイベントへの紐づけも残る
    const linked = restored.tasks.filter((t) => t.eventId !== null);
    expect(linked.length).toBeGreaterThan(0);
    expect(restored.events.some((e) => e.id === linked[0]?.eventId)).toBe(true);
  });

  it('events が無い古いデータは空配列として読める', () => {
    const restored = parseAppData({ tasks: [{ title: 'ふるいデータ' }] });
    expect(restored.events).toEqual([]);
    expect(restored.tasks[0]?.eventId).toBeNull();
  });

  it('存在しないイベントを指す eventId は外す', () => {
    const restored = parseAppData({
      tasks: [{ title: 'a', eventId: 'missing' }],
      events: [],
    });
    expect(restored.tasks[0]?.eventId).toBeNull();
  });

  it('生きているイベントへの紐づけは残す', () => {
    const restored = parseAppData({
      tasks: [{ title: 'a', eventId: 'e_1' }],
      events: [{ id: 'e_1', title: '展示会', date: '2026-10-12' }],
    });
    expect(restored.tasks[0]?.eventId).toBe('e_1');
  });

  it('終日のときは時刻を持たない', () => {
    const event = makeEvent({ title: 'x', allDay: true, startTime: '10:00', endTime: '12:00' });
    expect(event.startTime).toBeNull();
    expect(event.endTime).toBeNull();
  });

  it('壊れた時刻・逆転した終了時刻は落とす', () => {
    expect(makeEvent({ title: 'x', allDay: false, startTime: '25:00' }).startTime).toBeNull();
    // 開始が無ければ終了も持たない
    expect(makeEvent({ title: 'x', allDay: false, endTime: '12:00' }).endTime).toBeNull();
    expect(
      makeEvent({ title: 'x', allDay: false, startTime: '10:00', endTime: '09:00' }).endTime,
    ).toBeNull();
  });

  it('終了日は開始日より後のときだけ持つ', () => {
    expect(makeEvent({ title: 'x', date: '2026-10-12', endDate: '2026-10-14' }).endDate).toBe(
      '2026-10-14',
    );
    // 同じ日・過去の日は単日として持つ
    expect(makeEvent({ title: 'x', date: '2026-10-12', endDate: '2026-10-12' }).endDate).toBeNull();
    expect(makeEvent({ title: 'x', date: '2026-10-12', endDate: '2026-10-11' }).endDate).toBeNull();
    expect(makeEvent({ title: 'x', date: '2026-10-12', endDate: 'こわれた' }).endDate).toBeNull();
  });

  it('日をまたぐときは終了時刻が開始より早くてよい', () => {
    // 10/12 18:00 から 10/14 09:00 まで
    const across = makeEvent({
      title: '合宿',
      date: '2026-10-12',
      endDate: '2026-10-14',
      allDay: false,
      startTime: '18:00',
      endTime: '09:00',
    });
    expect(across.endTime).toBe('09:00');
    // 単日なら従来どおり落とす
    const sameDay = makeEvent({
      title: '打ち合わせ',
      date: '2026-10-12',
      allDay: false,
      startTime: '18:00',
      endTime: '09:00',
    });
    expect(sameDay.endTime).toBeNull();
  });

  it('endDate が無い古いデータは単日として読める', () => {
    const restored = parseAppData({
      tasks: [],
      events: [{ id: 'e_1', title: '展示会', date: '2026-10-12' }],
    });
    expect(restored.events[0]?.endDate).toBeNull();
  });

  it('HH:MM の判定', () => {
    expect(isHhMm('09:00')).toBe(true);
    expect(isHhMm('23:59')).toBe(true);
    expect(isHhMm('9:00')).toBe(false);
    expect(isHhMm('24:00')).toBe(false);
    expect(isHhMm('')).toBe(false);
  });
});

describe('たのしみの検証', () => {
  it('エクスポートした種類と娯楽を読み戻せる', () => {
    const data = defaultAppData();
    const restored = parseAppData(JSON.parse(toExportJson(data)));
    expect(restored.mediaKinds.map((k) => k.name)).toEqual(data.mediaKinds.map((k) => k.name));
    expect(restored.media).toHaveLength(data.media.length);
    expect(restored.media[0]?.kindId).toBe(data.media[0]?.kindId);
  });

  it('種類を持たない古いデータには既定の種類を入れる', () => {
    const restored = parseAppData({ tasks: [] });
    expect(restored.mediaKinds.map((k) => k.name)).toEqual(['映画', 'ゲーム', '本', 'アニメ']);
    expect(restored.media).toEqual([]);
    expect(restored.ui.filterMediaKindIds).toEqual([]);
  });

  it('種類を全部消した状態はそのまま読む', () => {
    const restored = parseAppData({ tasks: [], mediaKinds: [] });
    expect(restored.mediaKinds).toEqual([]);
  });

  it('消えた種類を指す娯楽は未分類にする', () => {
    const restored = parseAppData({
      tasks: [],
      mediaKinds: [{ id: 'k_1', name: '映画', color: '#000' }],
      media: [
        { title: 'a', kindId: 'k_1' },
        { title: 'b', kindId: 'missing' },
      ],
      ui: { filterMediaKindIds: ['k_1', 'missing'] },
    });
    expect(restored.media.map((m) => m.kindId)).toEqual(['k_1', null]);
    expect(restored.ui.filterMediaKindIds).toEqual(['k_1']);
  });

  it('欠けたフィールドや範囲外の値は既定値に寄せる', () => {
    const restored = parseAppData({
      tasks: [],
      mediaKinds: [],
      media: [{ title: ' ', status: 'watching', rating: 9, startedAt: 'きのう' }],
    });
    const item = restored.media[0]!;
    expect(item.title).toBe('(無題)');
    expect(item.status).toBe('want');
    expect(item.rating).toBe(5);
    expect(item.startedAt).toBeNull();
    expect(item.progress).toBe('');
  });
});

describe('たのしみの並び順', () => {
  it('並び順を持たない古いデータは、済にした日が新しい順・新しく足した順に揃える', () => {
    const restored = parseAppData({
      tasks: [],
      mediaKinds: [],
      media: [
        { title: '古い', createdAt: '2026-10-01T00:00:00Z' },
        { title: '新しい', createdAt: '2026-10-05T00:00:00Z' },
        { title: '先に済', status: 'done', finishedAt: '2026-10-02', createdAt: '2026-10-09T00:00:00Z' },
        { title: '後で済', status: 'done', finishedAt: '2026-10-08', createdAt: '2026-09-01T00:00:00Z' },
      ],
    });
    const order = (status: string) =>
      restored.media
        .filter((m) => m.status === status)
        .sort((a, b) => a.order - b.order)
        .map((m) => `${m.order}:${m.title}`);
    expect(order('want')).toEqual(['0:新しい', '1:古い']);
    expect(order('done')).toEqual(['0:後で済', '1:先に済']);
  });

  it('並び順は状態ごとに 0 から振り直す', () => {
    const items = normalizeMediaOrders([
      makeMediaItem({ title: 'a', order: 5 }),
      makeMediaItem({ title: 'b', order: 2 }),
      makeMediaItem({ title: 'c', status: 'playing', order: 9 }),
    ]);
    expect(items.map((m) => `${m.title}:${m.order}`)).toEqual(['a:1', 'b:0', 'c:0']);
  });
});
