import type {
  AppData,
  AppEvent,
  EventSeries,
  HhMm,
  MediaItem,
  MediaKind,
  MediaStatus,
  Priority,
  Settings,
  Stage,
  Tag,
  Task,
  UiState,
  Weekday,
} from '../types';
import { MEDIA_STATUSES, STAGES } from '../types';
import { addDays, fromIsoDate, today } from '../lib/date';
import { createId } from '../lib/id';
import { normalizeHexColor } from '../lib/taskColor';

export const STORAGE_KEY = 'task_man.state';
export const SCHEMA_VERSION = 4;

export const DEFAULT_SETTINGS: Settings = {
  dailyCapacityMinutes: 360,
  theme: 'system',
  weekStartsOn: 1,
};

export function defaultUi(): UiState {
  const now = today();
  return {
    view: 'board',
    boardLayout: 'kanban',
    weekAnchor: now,
    monthAnchor: now,
    search: '',
    filterTagIds: [],
    showDone: false,
    sortKey: 'manual',
    filterMediaKindIds: [],
  };
}

export const TAG_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#64748b',
];

/** 未設定のフィールドを埋めてタスクを作る。インポートや移行でも使う */
export function makeTask(patch: Partial<Task> & { title: string }): Task {
  const now = new Date().toISOString();
  return {
    id: patch.id ?? createId(),
    title: patch.title,
    note: patch.note ?? '',
    stage: isStage(patch.stage) ? patch.stage : 'soon',
    order: typeof patch.order === 'number' ? patch.order : 0,
    parentId: patch.parentId ?? null,
    collapsed: patch.collapsed ?? false,
    estimateMinutes:
      typeof patch.estimateMinutes === 'number' && patch.estimateMinutes > 0
        ? patch.estimateMinutes
        : null,
    dueDate: isIsoDate(patch.dueDate) ? patch.dueDate : null,
    scheduledDate: isIsoDate(patch.scheduledDate) ? patch.scheduledDate : null,
    scheduledOrder: typeof patch.scheduledOrder === 'number' ? patch.scheduledOrder : 0,
    tagIds: Array.isArray(patch.tagIds) ? patch.tagIds.filter((t) => typeof t === 'string') : [],
    // 実在しないイベントを指していないかは parseAppData 側で直す
    eventId: typeof patch.eventId === 'string' ? patch.eventId : null,
    priority: isPriority(patch.priority) ? patch.priority : 'normal',
    color: normalizeHexColor(patch.color),
    done: patch.done === true,
    completedAt: patch.completedAt ?? null,
    createdAt: patch.createdAt ?? now,
    updatedAt: patch.updatedAt ?? now,
  };
}

function isStage(value: unknown): value is Stage {
  return typeof value === 'string' && (STAGES as string[]).includes(value);
}

function isPriority(value: unknown): value is Priority {
  return value === 'high' || value === 'normal' || value === 'low';
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** 'HH:MM'（00:00〜23:59）か */
export function isHhMm(value: unknown): value is HhMm {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/**
 * 未設定のフィールドを埋めてイベントを作る。インポートや移行でも使う。
 * 「終日なら時刻を持たない」「終了だけある状態を作らない」
 * 「終了日は開始日より後」を必ず成立させる。
 */
export function makeEvent(patch: Partial<AppEvent> & { title: string }): AppEvent {
  const now = new Date().toISOString();
  const date = isIsoDate(patch.date) ? patch.date : today();
  // 同じ日を指す終了日は単日として持つ。表現を 1 つに保つため
  const endDate = isIsoDate(patch.endDate) && patch.endDate > date ? patch.endDate : null;
  const allDay = patch.allDay !== false;
  const startTime = !allDay && isHhMm(patch.startTime) ? patch.startTime : null;
  // 日をまたぐ場合、終了は別の日の時刻なので開始より早くてよい
  const endTime =
    startTime && isHhMm(patch.endTime) && (endDate !== null || patch.endTime >= startTime)
      ? patch.endTime
      : null;
  return {
    id: patch.id ?? createId('e'),
    title: patch.title,
    note: patch.note ?? '',
    date,
    endDate,
    allDay,
    startTime,
    endTime,
    // 実在しない定期を指していないかは parseAppData 側で直す
    seriesId: typeof patch.seriesId === 'string' ? patch.seriesId : null,
    occurrenceDate:
      typeof patch.seriesId === 'string' && isIsoDate(patch.occurrenceDate)
        ? patch.occurrenceDate
        : null,
    cancelled: patch.cancelled === true,
    customized: patch.customized === true,
    createdAt: patch.createdAt ?? now,
    updatedAt: patch.updatedAt ?? now,
  };
}

function isWeekday(value: unknown): value is Weekday {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6;
}

/**
 * 未設定のフィールドを埋めて定期を作る。インポートや移行でも使う。
 * 時刻の決まりは単日のイベントと同じ。曜日が 1 つも無ければ開始日の曜日にする。
 */
export function makeEventSeries(patch: Partial<EventSeries> & { title: string }): EventSeries {
  const now = new Date().toISOString();
  const startDate = isIsoDate(patch.startDate) ? patch.startDate : today();
  const endDate = isIsoDate(patch.endDate) && patch.endDate >= startDate ? patch.endDate : null;
  const picked = Array.isArray(patch.weekdays) ? patch.weekdays.filter(isWeekday) : [];
  const weekdays = [...new Set(picked)].sort((a, b) => a - b);
  if (weekdays.length === 0) weekdays.push(fromIsoDate(startDate).getDay() as Weekday);
  const allDay = patch.allDay !== false;
  const startTime = !allDay && isHhMm(patch.startTime) ? patch.startTime : null;
  const endTime =
    startTime && isHhMm(patch.endTime) && patch.endTime >= startTime ? patch.endTime : null;
  return {
    id: patch.id ?? createId('s'),
    title: patch.title,
    note: patch.note ?? '',
    weekdays,
    allDay,
    startTime,
    endTime,
    startDate,
    endDate,
    createdAt: patch.createdAt ?? now,
    updatedAt: patch.updatedAt ?? now,
  };
}

/** 種類を持たないデータ（初回・v2 以前）に入れる種類 */
export function defaultMediaKinds(): MediaKind[] {
  return ['映画', 'ゲーム', '本', 'アニメ'].map((name, i) => ({
    id: createId('k'),
    name,
    color: TAG_COLORS[i % TAG_COLORS.length]!,
  }));
}

function isMediaStatus(value: unknown): value is MediaStatus {
  return typeof value === 'string' && (MEDIA_STATUSES as string[]).includes(value);
}

/**
 * 未設定のフィールドを埋めて娯楽を作る。インポートや移行でも使う。
 * 実在しない種類を指していないかは parseAppData 側で直す。
 */
export function makeMediaItem(patch: Partial<MediaItem> & { title: string }): MediaItem {
  const now = new Date().toISOString();
  const rating =
    typeof patch.rating === 'number' && Number.isFinite(patch.rating)
      ? Math.min(Math.max(Math.round(patch.rating), 1), 5)
      : null;
  return {
    id: patch.id ?? createId('m'),
    title: patch.title,
    kindId: typeof patch.kindId === 'string' ? patch.kindId : null,
    status: isMediaStatus(patch.status) ? patch.status : 'want',
    // 並び順を持たない古いデータは末尾扱いにし、normalizeMediaOrders で従来の並びに揃える
    order:
      typeof patch.order === 'number' && Number.isFinite(patch.order)
        ? patch.order
        : Number.MAX_SAFE_INTEGER,
    progress: typeof patch.progress === 'string' ? patch.progress : '',
    where: typeof patch.where === 'string' ? patch.where : '',
    note: typeof patch.note === 'string' ? patch.note : '',
    rating,
    startedAt: isIsoDate(patch.startedAt) ? patch.startedAt : null,
    finishedAt: isIsoDate(patch.finishedAt) ? patch.finishedAt : null,
    createdAt: patch.createdAt ?? now,
    updatedAt: patch.updatedAt ?? now,
  };
}

/**
 * 状態ごとに並び順を 0..n-1 で振り直す。新しい配列を返し、引数は書き換えない。
 * 並び順が同じもの（order を持たない古いデータ）は、手動の並べ替えができる前の並び
 * （済にした日が新しい順、次に新しく足した順）で決める。
 */
export function normalizeMediaOrders(items: MediaItem[]): MediaItem[] {
  const result = items.map((item) => ({ ...item }));
  const groups = new Map<MediaStatus, MediaItem[]>();
  for (const item of result) {
    const group = groups.get(item.status);
    if (group) group.push(item);
    else groups.set(item.status, [item]);
  }
  for (const group of groups.values()) {
    group.sort(
      (a, b) =>
        a.order - b.order ||
        (b.finishedAt ?? '').localeCompare(a.finishedAt ?? '') ||
        b.createdAt.localeCompare(a.createdAt),
    );
    group.forEach((item, index) => {
      item.order = index;
    });
  }
  return result;
}

/** 初回起動時に入れるサンプル。空画面のまま何をすればいいか分からない状態を避ける */
export function seedData(): Pick<AppData, 'tasks' | 'tags' | 'events' | 'mediaKinds' | 'media'> {
  const work: Tag = { id: createId('g'), name: '仕事', color: TAG_COLORS[0]! };
  const personal: Tag = { id: createId('g'), name: '私用', color: TAG_COLORS[1]! };
  const parentId = createId();
  const eventId = createId('e');

  const events: AppEvent[] = [
    makeEvent({
      id: eventId,
      title: '展示会',
      note: 'イベントに紐づけたタスクは、イベント画面で進み具合をまとめて見られます',
      date: addDays(today(), 3),
      endDate: addDays(today(), 4),
      allDay: false,
      startTime: '10:00',
      endTime: '17:00',
    }),
  ];

  const tasks: Task[] = [
    makeTask({
      id: parentId,
      title: 'task_man を自分の使い方に合わせて調整する',
      note: '使いながら気づいたことをここにメモする',
      stage: 'now',
      order: 0,
      estimateMinutes: 90,
      dueDate: addDays(today(), 2),
      scheduledDate: today(),
      tagIds: [personal.id],
      priority: 'high',
    }),
    makeTask({
      title: 'サンプルのサブタスク（ドラッグで並べ替えできます）',
      stage: 'now',
      order: 0,
      parentId,
      estimateMinutes: 30,
    }),
    makeTask({
      title: 'もう一つのサブタスク',
      stage: 'now',
      order: 1,
      parentId,
      estimateMinutes: 60,
    }),
    makeTask({
      title: '週タイムラインにタスクをドラッグして予定を組む',
      stage: 'now',
      order: 1,
      estimateMinutes: 45,
      tagIds: [work.id],
      eventId,
    }),
    makeTask({
      title: 'エクスポートでバックアップを取る',
      stage: 'soon',
      order: 0,
      estimateMinutes: 15,
      tagIds: [work.id],
    }),
    makeTask({
      title: 'いつかやりたいことを書き出す',
      stage: 'later',
      order: 0,
      estimateMinutes: 240,
    }),
  ];

  const mediaKinds = defaultMediaKinds();
  const media: MediaItem[] = [
    makeMediaItem({
      title: '気になっている映画',
      order: 0,
      kindId: mediaKinds[0]!.id,
      note: '見たい映画ややりかけのゲームなど、タスクではない楽しみをここに置きます',
    }),
  ];

  return { tasks, tags: [work, personal], events, mediaKinds, media };
}

export function defaultAppData(): AppData {
  const { tasks, tags, events, mediaKinds, media } = seedData();
  return {
    schemaVersion: SCHEMA_VERSION,
    tasks,
    tags,
    events,
    eventSeries: [],
    mediaKinds,
    media,
    settings: { ...DEFAULT_SETTINGS },
    ui: defaultUi(),
  };
}

export class ImportError extends Error {}

/**
 * 外部から来た JSON を AppData に整える。
 * 足りないフィールドは既定値で補い、致命的に形が違うときだけ ImportError を投げる。
 */
export function parseAppData(raw: unknown): AppData {
  if (typeof raw !== 'object' || raw === null) {
    throw new ImportError('JSON の形式が正しくありません。');
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.tasks)) {
    throw new ImportError('tasks 配列が見つかりません。task_man のバックアップファイルか確認してください。');
  }

  const tags: Tag[] = Array.isArray(obj.tags)
    ? obj.tags
        .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
        .map((t, i) => ({
          id: typeof t.id === 'string' ? t.id : createId('g'),
          name: typeof t.name === 'string' ? t.name : `タグ${i + 1}`,
          color: typeof t.color === 'string' ? t.color : TAG_COLORS[i % TAG_COLORS.length]!,
        }))
    : [];

  // events は無くてもよい（v1 のデータには存在しない）
  const events: AppEvent[] = Array.isArray(obj.events)
    ? obj.events
        .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
        .map((e) =>
          makeEvent({
            ...(e as Partial<AppEvent>),
            title: typeof e.title === 'string' && e.title.trim() ? e.title : '(無題のイベント)',
          }),
        )
    : [];

  // eventSeries は無くてもよい（v3 以前のデータには存在しない）
  const eventSeries: EventSeries[] = Array.isArray(obj.eventSeries)
    ? obj.eventSeries
        .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
        .map((r) =>
          makeEventSeries({
            ...(r as Partial<EventSeries>),
            title: typeof r.title === 'string' && r.title.trim() ? r.title : '(無題の定期)',
          }),
        )
    : [];
  // 消えた定期を指している回は単発に戻す
  const seriesIds = new Set(eventSeries.map((r) => r.id));
  for (const event of events) {
    if (event.seriesId && !seriesIds.has(event.seriesId)) {
      event.seriesId = null;
      event.occurrenceDate = null;
      event.customized = false;
    }
  }

  // 種類を持たないデータ（v2 以前）には既定の種類を入れる。空配列なら全部消した状態として尊重する
  const mediaKinds: MediaKind[] = Array.isArray(obj.mediaKinds)
    ? obj.mediaKinds
        .filter((k): k is Record<string, unknown> => typeof k === 'object' && k !== null)
        .map((k, i) => ({
          id: typeof k.id === 'string' ? k.id : createId('k'),
          name: typeof k.name === 'string' && k.name.trim() ? k.name : `種類${i + 1}`,
          color: typeof k.color === 'string' ? k.color : TAG_COLORS[i % TAG_COLORS.length]!,
        }))
    : defaultMediaKinds();
  const kindIds = new Set(mediaKinds.map((k) => k.id));

  const mediaRaw = Array.isArray(obj.media) ? obj.media : [];
  const media: MediaItem[] = normalizeMediaOrders(
    mediaRaw
      .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
      .map((m) => {
        const item = makeMediaItem({
          ...(m as Partial<MediaItem>),
          title: typeof m.title === 'string' && m.title.trim() ? m.title : '(無題)',
        });
        // 消えた種類を指したままにしない
        if (item.kindId && !kindIds.has(item.kindId)) item.kindId = null;
        return item;
      }),
  );

  const tasks: Task[] = obj.tasks
    .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
    .map((t) =>
      makeTask({
        ...(t as Partial<Task>),
        title: typeof t.title === 'string' && t.title.trim() ? t.title : '(無題)',
      }),
    );

  // 親が存在しないサブタスクは孤児になるのでトップレベルに戻す
  const ids = new Set(tasks.map((t) => t.id));
  const eventIds = new Set(events.map((e) => e.id));
  for (const task of tasks) {
    if (task.parentId && !ids.has(task.parentId)) task.parentId = null;
    // 孫は許容しないので、親がサブタスクだった場合も引き上げる
    const parent = tasks.find((p) => p.id === task.parentId);
    if (parent?.parentId) task.parentId = parent.parentId;
    // 消えたイベントを指したままにしない
    if (task.eventId && !eventIds.has(task.eventId)) task.eventId = null;
  }

  const settingsRaw = (obj.settings ?? {}) as Partial<Settings>;
  const settings: Settings = {
    dailyCapacityMinutes:
      typeof settingsRaw.dailyCapacityMinutes === 'number' && settingsRaw.dailyCapacityMinutes > 0
        ? settingsRaw.dailyCapacityMinutes
        : DEFAULT_SETTINGS.dailyCapacityMinutes,
    theme:
      settingsRaw.theme === 'light' || settingsRaw.theme === 'dark' || settingsRaw.theme === 'system'
        ? settingsRaw.theme
        : DEFAULT_SETTINGS.theme,
    weekStartsOn: settingsRaw.weekStartsOn === 0 ? 0 : 1,
  };

  const ui: UiState = { ...defaultUi(), ...((obj.ui ?? {}) as Partial<UiState>) };
  // 保存されていた検索条件で「タスクが消えた」ように見えるのを防ぐ
  ui.search = '';
  ui.filterTagIds = ui.filterTagIds.filter((id) => tags.some((tag) => tag.id === id));
  ui.filterMediaKindIds = Array.isArray(ui.filterMediaKindIds)
    ? ui.filterMediaKindIds.filter((id) => kindIds.has(id))
    : [];

  return {
    schemaVersion: SCHEMA_VERSION,
    tasks,
    tags,
    events,
    eventSeries,
    mediaKinds,
    media,
    settings,
    ui,
  };
}

/** localStorage に入っていた旧バージョンのデータを現行スキーマへ移行する */
export function migrate(persisted: unknown, version: number): AppData {
  if (version < SCHEMA_VERSION) {
    // v1 -> v2: events 配列と task.eventId を足した。
    // v2 -> v3: mediaKinds / media 配列と ui.filterMediaKindIds を足した。
    // v3 -> v4: eventSeries 配列と、event の seriesId / occurrenceDate / cancelled / customized を足した。
    // どれも parseAppData と make* が既定値で埋めるので、通すだけでよい。
    try {
      return parseAppData(persisted);
    } catch {
      return defaultAppData();
    }
  }
  return persisted as AppData;
}
