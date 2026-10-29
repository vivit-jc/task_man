import { describe, expect, it } from 'vitest';
import { makeEvent, makeMediaItem, makeTask } from './persist';
import {
  allSubtasksDone,
  allSubtasksScheduled,
  compareEvents,
  dayTasks,
  daySummary,
  eventEnd,
  eventProgress,
  eventsOn,
  groupEvents,
  groupMediaByStatus,
  matchesMediaKind,
  matchesMediaText,
  nestedSubtasks,
  scheduledMinutes,
  sortedEvents,
  unscheduledDraggables,
  unscheduledGroups,
} from './selectors';
import type { AppEvent, MediaItem, Task } from '../types';

const NO_FILTER = { search: '', tagIds: [] };

function task(patch: Partial<Task> & { id: string; title: string }): Task {
  return makeTask(patch);
}

/** 親（見積もりなし）と、見積もり付きのサブタスク 2 件 */
function family(): Task[] {
  return [
    task({ id: 'p', title: '資料をまとめる' }),
    task({ id: 'c1', title: '構成を決める', parentId: 'p', estimateMinutes: 60, order: 0 }),
    task({ id: 'c2', title: '本文を書く', parentId: 'p', estimateMinutes: 120, order: 1 }),
  ];
}

describe('その日に数える見積もり', () => {
  it('親は、日が決まっていない子の分だけを持つ', () => {
    const tasks = family();
    expect(scheduledMinutes(tasks[0]!, tasks)).toBe(180);

    tasks[2]!.scheduledDate = '2026-09-24';
    expect(scheduledMinutes(tasks[0]!, tasks)).toBe(60);
  });

  it('子を別の日に置いても、週の合計は二重に数えない', () => {
    const tasks = family();
    tasks[0]!.scheduledDate = '2026-09-22';
    tasks[2]!.scheduledDate = '2026-09-24';

    expect(daySummary(tasks, '2026-09-22').total).toBe(60);
    expect(daySummary(tasks, '2026-09-24').total).toBe(120);
  });

  it('親と子を同じ日に置いても合計は変わらない', () => {
    const tasks = family();
    tasks[0]!.scheduledDate = '2026-09-22';
    tasks[1]!.scheduledDate = '2026-09-22';
    tasks[2]!.scheduledDate = '2026-09-22';

    expect(daySummary(tasks, '2026-09-22').total).toBe(180);
  });

  it('子に見積もりが無ければ親の見積もりを使う', () => {
    const tasks = [
      task({ id: 'p', title: '親', estimateMinutes: 90 }),
      task({ id: 'c', title: '子', parentId: 'p' }),
    ];
    expect(scheduledMinutes(tasks[0]!, tasks)).toBe(90);
  });
});

describe('未配置ペインの中身', () => {
  it('未配置のサブタスクは親の下に並ぶ', () => {
    const groups = unscheduledGroups(family(), NO_FILTER);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.children.map((t) => t.id)).toEqual(['c1', 'c2']);
    expect(unscheduledDraggables(groups).map((t) => t.id)).toEqual(['p', 'c1', 'c2']);
  });

  it('親を置いたら、日の決まっていない子ごとペインから消える', () => {
    const tasks = family();
    tasks[0]!.scheduledDate = '2026-09-22';

    // 子はその日の親の中に入れ子で出るので、ペインには残さない
    expect(unscheduledGroups(tasks, NO_FILTER)).toHaveLength(0);
    expect(nestedSubtasks(tasks, tasks[0]!).map((t) => t.id)).toEqual(['c1', 'c2']);
  });

  it('自分で日を決めた子は、親の入れ子には出ない', () => {
    const tasks = family();
    tasks[0]!.scheduledDate = '2026-09-22';
    tasks[2]!.scheduledDate = '2026-09-24';

    // c2 は 9/24 に単独のチップとして出る
    expect(nestedSubtasks(tasks, tasks[0]!).map((t) => t.id)).toEqual(['c1']);
    expect(dayTasks(tasks, '2026-09-24').map((t) => t.id)).toEqual(['c2']);
  });

  it('親も子も行き先が決まっていれば何も出ない', () => {
    const tasks = family();
    for (const t of tasks) t.scheduledDate = '2026-09-22';
    expect(unscheduledGroups(tasks, NO_FILTER)).toHaveLength(0);
  });

  it('子が全部配置済みかどうかを見分けられる', () => {
    const tasks = family();
    expect(allSubtasksScheduled(tasks, tasks[0]!)).toBe(false);

    tasks[1]!.scheduledDate = '2026-09-22';
    expect(allSubtasksScheduled(tasks, tasks[0]!)).toBe(false);

    tasks[2]!.scheduledDate = '2026-09-24';
    expect(allSubtasksScheduled(tasks, tasks[0]!)).toBe(true);
    // 親はまだ未配置なのでペインに残り、下に出す子は居ない
    expect(unscheduledGroups(tasks, NO_FILTER)[0]!.children).toEqual([]);
  });

  it('サブタスクを持たないタスクは「全配置済」にしない', () => {
    const tasks = [task({ id: 'solo', title: '単体のタスク' })];
    expect(allSubtasksScheduled(tasks, tasks[0]!)).toBe(false);
  });

  it('完了済みで日の無い子は「全配置済」の判定に含めない', () => {
    const tasks = family();
    tasks[1]!.done = true;
    tasks[2]!.scheduledDate = '2026-09-24';
    expect(allSubtasksScheduled(tasks, tasks[0]!)).toBe(true);
    expect(allSubtasksDone(tasks, tasks[0]!)).toBe(false);
    expect(unscheduledGroups(tasks, NO_FILTER)[0]!.children).toEqual([]);
  });

  it('子が全部完了していれば「全完了」で、「全配置済」にはしない', () => {
    const tasks = family();
    tasks[1]!.done = true;
    tasks[2]!.done = true;
    expect(allSubtasksDone(tasks, tasks[0]!)).toBe(true);
    expect(allSubtasksScheduled(tasks, tasks[0]!)).toBe(false);
  });

  it('サブタスクを持たないタスクは「全完了」にしない', () => {
    const tasks = [task({ id: 'solo', title: '単体のタスク' })];
    expect(allSubtasksDone(tasks, tasks[0]!)).toBe(false);
  });

  it('完了したものは出ない', () => {
    const tasks = family();
    tasks[1]!.done = true;
    const groups = unscheduledGroups(tasks, NO_FILTER);
    expect(groups[0]!.children.map((t) => t.id)).toEqual(['c2']);
  });

  it('絞り込みは親ごと落とす', () => {
    expect(unscheduledGroups(family(), { search: '該当なし', tagIds: [] })).toHaveLength(0);
    // 子が引っかかれば親ごと残る
    expect(unscheduledGroups(family(), { search: '本文', tagIds: [] })).toHaveLength(1);
  });
});

function event(patch: Partial<AppEvent> & { id: string; title: string }): AppEvent {
  return makeEvent(patch);
}

describe('イベントの並び', () => {
  it('同じ日なら終日が先、次に開始時刻の早い順', () => {
    const events = [
      event({ id: 'b', title: '午後の打ち合わせ', date: '2026-09-20', allDay: false, startTime: '14:00' }),
      event({ id: 'c', title: '朝礼', date: '2026-09-20', allDay: false, startTime: '09:00' }),
      event({ id: 'a', title: '社内研修', date: '2026-09-20', allDay: true }),
    ];
    expect(sortedEvents(events).map((e) => e.id)).toEqual(['a', 'c', 'b']);
  });

  it('時刻未定はその日の最後に回す', () => {
    const events = [
      event({ id: 'x', title: '時間未定', date: '2026-09-20', allDay: false }),
      event({ id: 'y', title: '夕方', date: '2026-09-20', allDay: false, startTime: '17:00' }),
    ];
    expect([...events].sort(compareEvents).map((e) => e.id)).toEqual(['y', 'x']);
  });

  it('その日のイベントだけを返す', () => {
    const events = [
      event({ id: 'a', title: '当日', date: '2026-09-20' }),
      event({ id: 'b', title: '翌日', date: '2026-09-21' }),
    ];
    expect(eventsOn(events, '2026-09-20').map((e) => e.id)).toEqual(['a']);
  });

  it('複数日のイベントは間の日にも出る', () => {
    const events = [
      event({ id: 'camp', title: '合宿', date: '2026-10-12', endDate: '2026-10-14' }),
      event({ id: 'solo', title: '打ち合わせ', date: '2026-10-13' }),
    ];
    expect(eventsOn(events, '2026-10-11').map((e) => e.id)).toEqual([]);
    expect(eventsOn(events, '2026-10-12').map((e) => e.id)).toEqual(['camp']);
    // 同じ日なら長くかかるものが先
    expect(eventsOn(events, '2026-10-13').map((e) => e.id)).toEqual(['camp', 'solo']);
    expect(eventsOn(events, '2026-10-14').map((e) => e.id)).toEqual(['camp']);
    expect(eventsOn(events, '2026-10-15').map((e) => e.id)).toEqual([]);
  });

  it('終了日は単日なら開始日そのもの', () => {
    expect(eventEnd(event({ id: 'a', title: 'x', date: '2026-10-12' }))).toBe('2026-10-12');
    expect(
      eventEnd(event({ id: 'b', title: 'x', date: '2026-10-12', endDate: '2026-10-14' })),
    ).toBe('2026-10-14');
  });

  it('開催中のイベントは「これから」に残る', () => {
    const events = [
      event({ id: 'running', title: '開催中', date: '2026-09-17', endDate: '2026-09-21' }),
      event({ id: 'done', title: '終わった', date: '2026-09-15', endDate: '2026-09-18' }),
    ];
    const { upcoming, past } = groupEvents(events, '2026-09-19');
    expect(upcoming.map((e) => e.id)).toEqual(['running']);
    expect(past.map((e) => e.id)).toEqual(['done']);
  });

  it('当日は「これから」に含める', () => {
    const events = [
      event({ id: 'past', title: '昨日', date: '2026-09-18' }),
      event({ id: 'today', title: '今日', date: '2026-09-19' }),
      event({ id: 'future', title: '来週', date: '2026-09-26' }),
    ];
    const { upcoming, past } = groupEvents(events, '2026-09-19');
    expect(upcoming.map((e) => e.id)).toEqual(['today', 'future']);
    expect(past.map((e) => e.id)).toEqual(['past']);
  });
});

describe('イベントの進み具合', () => {
  it('親と子の両方を紐づけても時間を二重に数えない', () => {
    const target = event({ id: 'ev', title: '展示会', date: '2026-09-25' });
    const tasks = family().map((t) => ({ ...t, eventId: 'ev' }));

    const progress = eventProgress(target, tasks);
    expect(progress.count).toBe(3);
    // 親の 180 分（子の合計）と子の 60 + 120 を足して 360 にしない
    expect(progress.minutes).toBe(180);
  });

  it('紐づいていないタスクは数えない', () => {
    const target = event({ id: 'ev', title: '展示会', date: '2026-09-25' });
    const tasks = family();
    expect(eventProgress(target, tasks).count).toBe(0);
  });

  it('完了した数を数える', () => {
    const target = event({ id: 'ev', title: '展示会', date: '2026-09-25' });
    const tasks = family().map((t) => ({ ...t, eventId: 'ev' }));
    tasks[1]!.done = true;
    expect(eventProgress(target, tasks).doneCount).toBe(1);
  });
});

describe('たのしみ', () => {
  const item = (patch: Partial<MediaItem> & { title: string }) => makeMediaItem(patch);

  it('題名・進み具合・どこで・メモのどれでも検索に当たる', () => {
    const m = item({ title: 'ゼルダ', progress: '3章まで', where: 'Switch', note: '友だちのおすすめ' });
    expect(matchesMediaText(m, 'ぜるだ')).toBe(false);
    expect(matchesMediaText(m, 'ゼルダ')).toBe(true);
    expect(matchesMediaText(m, '3章')).toBe(true);
    expect(matchesMediaText(m, 'switch')).toBe(true);
    expect(matchesMediaText(m, 'おすすめ')).toBe(true);
    expect(matchesMediaText(m, '')).toBe(true);
  });

  it('種類で絞り込むと未分類は出ない', () => {
    expect(matchesMediaKind(item({ title: 'a', kindId: 'k_1' }), ['k_1'])).toBe(true);
    expect(matchesMediaKind(item({ title: 'b', kindId: 'k_2' }), ['k_1'])).toBe(false);
    expect(matchesMediaKind(item({ title: 'c' }), ['k_1'])).toBe(false);
    expect(matchesMediaKind(item({ title: 'c' }), [])).toBe(true);
  });

  it('状態ごとに分け、それぞれ並び順に並べる', () => {
    const groups = groupMediaByStatus([
      item({ title: '2番目', order: 1 }),
      item({ title: '1番目', order: 0 }),
      item({ title: '済', status: 'done', order: 0 }),
      item({ title: '進行中', status: 'playing', order: 0 }),
    ]);
    expect(groups.want.map((m) => m.title)).toEqual(['1番目', '2番目']);
    expect(groups.done.map((m) => m.title)).toEqual(['済']);
    expect(groups.playing).toHaveLength(1);
    expect(groups.paused).toEqual([]);
  });
});
