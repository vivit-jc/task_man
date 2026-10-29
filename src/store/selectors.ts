import type { AppEvent, IsoDate, MediaItem, MediaStatus, Priority, SortKey, Stage, Task } from '../types';

const PRIORITY_RANK: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

export interface TaskFilter {
  search: string;
  tagIds: string[];
}

export function subtasksOf(tasks: Task[], parentId: string): Task[] {
  return tasks.filter((t) => t.parentId === parentId).sort((a, b) => a.order - b.order);
}

export function topLevel(tasks: Task[], stage: Stage): Task[] {
  return tasks
    .filter((t) => !t.parentId && t.stage === stage)
    .sort((a, b) => a.order - b.order);
}

function matchesText(task: Task, needle: string): boolean {
  if (!needle) return true;
  const lower = needle.toLowerCase();
  return (
    task.title.toLowerCase().includes(lower) || task.note.toLowerCase().includes(lower)
  );
}

/** 親はサブタスクが条件に合致した場合も表示する（子が見つからなくなるのを防ぐ） */
export function matchesFilter(task: Task, tasks: Task[], filter: TaskFilter): boolean {
  const children = subtasksOf(tasks, task.id);
  const hitsText = matchesText(task, filter.search) || children.some((c) => matchesText(c, filter.search));
  if (!hitsText) return false;
  if (filter.tagIds.length === 0) return true;
  const hasTag = (t: Task) => filter.tagIds.some((id) => t.tagIds.includes(id));
  return hasTag(task) || children.some(hasTag);
}

export function sortTasks(tasks: Task[], sortKey: SortKey): Task[] {
  if (sortKey === 'manual') return tasks;
  const sorted = tasks.slice();
  if (sortKey === 'due') {
    sorted.sort((a, b) => {
      if (a.dueDate === b.dueDate) return a.order - b.order;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  } else if (sortKey === 'priority') {
    sorted.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.order - b.order);
  } else if (sortKey === 'estimate') {
    sorted.sort((a, b) => {
      const av = a.estimateMinutes ?? Number.MAX_SAFE_INTEGER;
      const bv = b.estimateMinutes ?? Number.MAX_SAFE_INTEGER;
      return av - bv || a.order - b.order;
    });
  }
  return sorted;
}

export interface StageBuckets {
  active: Task[];
  done: Task[];
}

/** 段階カラムに出すタスク。未完了と完了済みを分けて返す */
export function stageBuckets(
  tasks: Task[],
  stage: Stage,
  filter: TaskFilter,
  sortKey: SortKey,
): StageBuckets {
  const all = topLevel(tasks, stage).filter((t) => matchesFilter(t, tasks, filter));
  return {
    active: sortTasks(all.filter((t) => !t.done), sortKey),
    done: all.filter((t) => t.done),
  };
}

/** タスク本体の見積もり。サブタスクに見積もりがあればその合計を優先する */
export function effectiveMinutes(task: Task, tasks: Task[]): number {
  const children = subtasksOf(tasks, task.id);
  const childSum = children.reduce((acc, c) => acc + (c.estimateMinutes ?? 0), 0);
  if (childSum > 0) return childSum;
  return task.estimateMinutes ?? 0;
}

/**
 * 週・月ビューで「その日の分」として数える見積もり。
 * サブタスクは単独で別の日に置けるので、親が抱えるのは日が決まっていない子の分だけ。
 * 日が決まった子は、その日のチップとして自分で数える。
 */
export function scheduledMinutes(task: Task, tasks: Task[]): number {
  const children = subtasksOf(tasks, task.id);
  if (children.length === 0) return task.estimateMinutes ?? 0;
  const childSum = children.reduce((acc, c) => acc + (c.estimateMinutes ?? 0), 0);
  // 子に見積もりが無ければ、親の見積もりをその日の分として使う
  if (childSum === 0) return task.estimateMinutes ?? 0;
  return children.reduce((acc, c) => (c.scheduledDate ? acc : acc + (c.estimateMinutes ?? 0)), 0);
}

export function dayTasks(tasks: Task[], date: IsoDate): Task[] {
  return tasks
    .filter((t) => t.scheduledDate === date)
    .sort((a, b) => a.scheduledOrder - b.scheduledOrder);
}

/** 配置日が today より前のまま、終わっていないタスク */
export function overdueScheduled(tasks: Task[], today: IsoDate): Task[] {
  return tasks.filter((t) => !t.done && t.scheduledDate != null && t.scheduledDate < today);
}

/** 週ビューの 1 日分の集計 */
export interface DaySummary {
  total: number;
  doneCount: number;
  count: number;
}

export function daySummary(tasks: Task[], date: IsoDate): DaySummary {
  const items = dayTasks(tasks, date);
  return {
    total: items.reduce((acc, task) => acc + scheduledMinutes(task, tasks), 0),
    doneCount: items.filter((t) => t.done).length,
    count: items.length,
  };
}

/** 未配置ペインの 1 まとまり。トップレベルのタスクと、その下に出す未配置のサブタスク */
export interface UnscheduledGroup {
  task: Task;
  children: Task[];
}

/**
 * 週ビューの左ペインに出すもの。
 * 親を日に置くと、日を決めていない子は親と一緒にその日へ移るので、まとめてペインから外す。
 */
export function unscheduledGroups(tasks: Task[], filter: TaskFilter): UnscheduledGroup[] {
  const stageRank: Record<Stage, number> = { now: 0, soon: 1, later: 2 };
  const parents = tasks
    .filter((t) => !t.parentId && !t.done && !t.scheduledDate && matchesFilter(t, tasks, filter))
    .sort((a, b) => stageRank[a.stage] - stageRank[b.stage] || a.order - b.order);

  return parents.map((task) => ({
    task,
    children: subtasksOf(tasks, task.id).filter((c) => !c.done && !c.scheduledDate),
  }));
}

/** ペインの中で実際に掴める行を、表示順に並べたもの */
export function unscheduledDraggables(groups: UnscheduledGroup[]): Task[] {
  return groups.flatMap((group) => [group.task, ...group.children]);
}

/**
 * 未完了のサブタスクを持っていて、その全部に日が決まっているか。
 * 未配置ペインでは、この親の下に出す子が居なくなるので、
 * サブタスクが無いタスクと見分けが付かなくなる。
 * 完了した子はペインに出さないので、日が無くても判定に含めない。
 */
export function allSubtasksScheduled(tasks: Task[], task: Task): boolean {
  const open = subtasksOf(tasks, task.id).filter((c) => !c.done);
  return open.length > 0 && open.every((c) => c.scheduledDate !== null);
}

/** サブタスクを持っていて、その全部が完了しているか。これも親の下に出す子が居なくなる */
export function allSubtasksDone(tasks: Task[], task: Task): boolean {
  const children = subtasksOf(tasks, task.id);
  return children.length > 0 && children.every((c) => c.done);
}

/**
 * その日の親チップの中に入れ子で出すサブタスク。
 * 日を決めていない子は親の日に含めて数えているので、表示も親と一緒にする。
 * 自分で日を決めた子は、その日に単独のチップとして出るのでここには入れない。
 */
export function nestedSubtasks(tasks: Task[], parent: Task): Task[] {
  if (parent.parentId) return [];
  return subtasksOf(tasks, parent.id).filter((c) => !c.scheduledDate);
}

export function countByTag(tasks: Task[], tagId: string): number {
  return tasks.filter((t) => t.tagIds.includes(tagId) && !t.done).length;
}

/* --- イベント --- */

/** 終了日。単日なら開始日そのもの */
export function eventEnd(event: AppEvent): IsoDate {
  return event.endDate && event.endDate > event.date ? event.endDate : event.date;
}

/** その日にかかっているか。複数日のイベントは間の日も含む */
export function eventSpansDate(event: AppEvent, date: IsoDate): boolean {
  return event.date <= date && date <= eventEnd(event);
}

/**
 * 開始日の早い順。同じ日なら、長くかかるものを先（帯として上に出す）、
 * 次に終日、次に開始時刻の早い順。時刻未定はその日の最後。
 */
export function compareEvents(a: AppEvent, b: AppEvent): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  const aEnd = eventEnd(a);
  const bEnd = eventEnd(b);
  if (aEnd !== bEnd) return bEnd.localeCompare(aEnd);
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  const at = a.startTime ?? '99:99';
  const bt = b.startTime ?? '99:99';
  if (at !== bt) return at.localeCompare(bt);
  return a.title.localeCompare(b.title, 'ja');
}

export function sortedEvents(events: AppEvent[]): AppEvent[] {
  return events.slice().sort(compareEvents);
}

export function eventsOn(events: AppEvent[], date: IsoDate): AppEvent[] {
  return events.filter((e) => eventSpansDate(e, date)).sort(compareEvents);
}

/** イベントの絞り込み。タグを持たないのでテキストだけ見る */
export function matchesEventText(event: AppEvent, search: string): boolean {
  if (!search) return true;
  const lower = search.toLowerCase();
  return event.title.toLowerCase().includes(lower) || event.note.toLowerCase().includes(lower);
}

export interface EventGroups {
  upcoming: AppEvent[];
  past: AppEvent[];
}

/**
 * 当日は「これから」に含める。判定は終了日で見るので、
 * すでに始まっていて開催中のイベントも「これから」に残る。
 * 終わったものは新しい順に並べる。
 */
export function groupEvents(events: AppEvent[], from: IsoDate): EventGroups {
  const sorted = sortedEvents(events);
  return {
    upcoming: sorted.filter((e) => eventEnd(e) >= from),
    past: sorted.filter((e) => eventEnd(e) < from).reverse(),
  };
}

export function upcomingEvents(events: AppEvent[], from: IsoDate, limit = 3): AppEvent[] {
  return groupEvents(events, from).upcoming.slice(0, limit);
}

export interface EventProgress {
  tasks: Task[];
  count: number;
  doneCount: number;
  minutes: number;
}

/**
 * イベントに紐づいたタスクと進み具合。
 * 紐づけは継承しないので、ここに出るのは直接紐づけたタスクだけ。
 * 親の effectiveMinutes には子の分が既に入っているので、
 * 親も紐づいている子は時間として数えない（二重計上を防ぐ）。
 */
export function eventProgress(event: AppEvent, tasks: Task[]): EventProgress {
  const stageRank: Record<Stage, number> = { now: 0, soon: 1, later: 2 };
  const linked = tasks
    .filter((t) => t.eventId === event.id)
    .sort((a, b) => stageRank[a.stage] - stageRank[b.stage] || a.order - b.order);
  const linkedIds = new Set(linked.map((t) => t.id));
  const minutes = linked.reduce(
    (acc, task) =>
      task.parentId && linkedIds.has(task.parentId) ? acc : acc + effectiveMinutes(task, tasks),
    0,
  );
  return {
    tasks: linked,
    count: linked.length,
    doneCount: linked.filter((t) => t.done).length,
    minutes,
  };
}

/** 題名・進み具合・どこで・メモのどれかに含まれていれば当たり */
export function matchesMediaText(item: MediaItem, search: string): boolean {
  if (!search) return true;
  const lower = search.toLowerCase();
  return [item.title, item.progress, item.where, item.note].some((text) =>
    text.toLowerCase().includes(lower),
  );
}

/** 種類で絞り込む。空なら全部。未分類は種類を選んでいるときは出さない */
export function matchesMediaKind(item: MediaItem, kindIds: string[]): boolean {
  if (kindIds.length === 0) return true;
  return item.kindId !== null && kindIds.includes(item.kindId);
}

/** 状態ごとに分け、それぞれ手動の並び順に並べる */
export function groupMediaByStatus(items: MediaItem[]): Record<MediaStatus, MediaItem[]> {
  const groups: Record<MediaStatus, MediaItem[]> = {
    want: [],
    playing: [],
    paused: [],
    done: [],
    dropped: [],
  };
  for (const item of items) groups[item.status].push(item);
  for (const list of Object.values(groups)) {
    list.sort((a, b) => a.order - b.order);
  }
  return groups;
}
