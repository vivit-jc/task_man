import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AppData,
  AppEvent,
  EventSeries,
  IsoDate,
  MediaItem,
  MediaKind,
  MediaStatus,
  Settings,
  Stage,
  Tag,
  Task,
  UiState,
} from '../types';
import { STAGES } from '../types';
import {
  SCHEMA_VERSION,
  STORAGE_KEY,
  TAG_COLORS,
  defaultAppData,
  makeEvent,
  makeEventSeries,
  makeMediaItem,
  makeTask,
  migrate,
  normalizeMediaOrders,
} from './persist';
import { createId } from '../lib/id';
import { today } from '../lib/date';
import { applySeriesChange, detachSeries, expandSeries } from '../lib/recurrence';
import { overdueScheduled, sortTasks, topLevel } from './selectors';
import { archive, makeArchiveEntry, unarchive } from './archive';

/** ドロップ先。段階カラム / 親タスクのサブタスク欄 / 週の 1 日 */
/**
 * 落とし先での位置。数値は並び全体での番号、anchor は「そのタスクの前か後か」。
 * 画面に出ている並びは完了済みやフィルタで間引かれているので、
 * カードの上に落としたときは番号ではなく anchor で指定しないと位置がずれる。
 */
export type DropPosition = number | { anchorId: string; after: boolean };

/** 並び（自分を除いた兄弟）のどこに差し込むかを決める。タスクにも娯楽にも使う */
export function insertIndex(siblings: { id: string }[], position: DropPosition): number {
  if (typeof position === 'number') return clamp(position, 0, siblings.length);
  const at = siblings.findIndex((t) => t.id === position.anchorId);
  if (at < 0) return siblings.length;
  return position.after ? at + 1 : at;
}

export type DropTarget =
  | { kind: 'stage'; stage: Stage }
  | { kind: 'parent'; parentId: string }
  | { kind: 'day'; date: IsoDate };

/**
 * unknown: 判定前 / off: ファイル保存なし（localStorage のみ）
 * saving: 送信中 / saved: 保存済み / error: 保存できなかった
 * conflict: ファイルが別の場所で更新されていて、上書きを止めた状態
 */
export type SyncStatus = 'unknown' | 'off' | 'saving' | 'saved' | 'error' | 'conflict';

export interface ToastState {
  id: string;
  message: string;
  /** 取り消しボタンを出すか */
  undoable: boolean;
}

/** 取り消し用のスナップショット。完了済みを削除したときは、そのとき足したアーカイブも持つ */
type UndoEntry = AppData & { archiveId?: string };

interface AppStore extends AppData {
  /** 取り消し用のスナップショット（永続化しない） */
  undoStack: UndoEntry[];
  toast: ToastState | null;
  /** 詳細パネルを開いているタスク（永続化しない） */
  selectedTaskId: string | null;
  selectTask(id: string | null): void;
  /** 詳細パネルを開いているイベント（永続化しない）。タスクとは同時に開かない */
  selectedEventId: string | null;
  selectEvent(id: string | null): void;
  /** 詳細パネルを開いている定期（永続化しない）。ほかのパネルとは同時に開かない */
  selectedSeriesId: string | null;
  selectSeries(id: string | null): void;
  /** 詳細パネルを開いている娯楽（永続化しない）。ほかのパネルとは同時に開かない */
  selectedMediaId: string | null;
  selectMedia(id: string | null): void;
  /** ローカルファイルへの保存状況（永続化しない） */
  syncStatus: SyncStatus;
  lastSavedAt: string | null;
  setSync(status: SyncStatus, lastSavedAt?: string | null): void;
  /** 起動時にファイルから読み込んだ内容で置き換える */
  hydrate(data: AppData): void;

  addTask(input: { title: string; stage: Stage; parentId?: string | null }): string;
  updateTask(id: string, patch: Partial<Task>): void;
  deleteTask(id: string): void;
  toggleDone(id: string): void;

  moveTask(activeId: string, target: DropTarget, position: DropPosition): void;
  /**
   * 期限順・優先度順などで表示している並びを、そのまま手動の並びとして取り込み、
   * 並べ替えを「手動」に切り替える。すでに手動なら何もせず false を返す
   */
  adoptSortedOrder(): boolean;
  unscheduleTask(id: string): void;
  /** その日に配置されたタスクをまとめて未配置に戻す */
  unscheduleDay(date: IsoDate): void;
  /** 昨日以前に配置されたまま終わっていないタスクを未配置に戻す */
  unscheduleOverdue(): void;

  addEvent(input: { title: string; date: IsoDate }): string;
  updateEvent(id: string, patch: Partial<AppEvent>): void;
  /** 削除。定期の回は消すと次の展開でまた作られるので、中止にする */
  deleteEvent(id: string): void;
  /** 中止にする / 中止を取り消す */
  setEventCancelled(id: string, cancelled: boolean): void;

  addSeries(input: { title: string; startDate: IsoDate }): string;
  /** 定期を書き換え、今日以降の（個別に編集していない）回も合わせる */
  updateSeries(id: string, patch: Partial<EventSeries>): void;
  /** 定期を消す。回は単発のイベントとして残し、今日以降の回は中止にする */
  deleteSeries(id: string): void;
  /** 今日から 2 ヶ月先までの回のうち、まだ無いものを置く。足した数を返す */
  expandRecurring(): number;
  /** タスクに紐づけるイベントを決める。null で解除 */
  setTaskEvent(taskId: string, eventId: string | null): void;

  addMedia(input: { title: string; kindId: string | null }): string;
  updateMedia(id: string, patch: Partial<MediaItem>): void;
  /** 状態を変える。初めて進行中にした日・済にした日もここで記録する */
  setMediaStatus(id: string, status: MediaStatus): void;
  /** ドラッグで並べ替える。別の状態の列に落とせば状態も変わる */
  moveMedia(activeId: string, status: MediaStatus, position: DropPosition): void;
  deleteMedia(id: string): void;

  addMediaKind(name: string): string | null;
  updateMediaKind(id: string, patch: Partial<Omit<MediaKind, 'id'>>): void;
  deleteMediaKind(id: string): void;

  addTag(name: string): string | null;
  updateTag(id: string, patch: Partial<Omit<Tag, 'id'>>): void;
  deleteTag(id: string): void;
  toggleTaskTag(taskId: string, tagId: string): void;

  setUi(patch: Partial<UiState>): void;
  setSettings(patch: Partial<Settings>): void;

  replaceData(data: AppData, message: string): void;
  clearCompleted(): void;
  undo(): void;
  showToast(message: string, undoable?: boolean): void;
  dismissToast(): void;
}

const UNDO_LIMIT = 20;

function byOrder(a: Task, b: Task): number {
  return a.order - b.order;
}

function snapshotOf(state: AppData): AppData {
  return {
    schemaVersion: state.schemaVersion,
    tasks: state.tasks.map((t) => ({ ...t })),
    tags: state.tags.map((t) => ({ ...t })),
    events: state.events.map((e) => ({ ...e })),
    eventSeries: state.eventSeries.map((r) => ({ ...r, weekdays: [...r.weekdays] })),
    mediaKinds: state.mediaKinds.map((k) => ({ ...k })),
    media: state.media.map((m) => ({ ...m })),
    settings: { ...state.settings },
    ui: { ...state.ui },
  };
}

/**
 * 並び順を破綻させないための後処理。
 * 段階ごと・親ごと・配置日ごとに 0..n-1 を振り直す。
 */
function normalizeOrders(tasks: Task[]): Task[] {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = task.parentId ? `p:${task.parentId}` : `s:${task.stage}`;
    const group = groups.get(key);
    if (group) group.push(task);
    else groups.set(key, [task]);
  }
  for (const group of groups.values()) {
    group.sort(byOrder);
    group.forEach((task, index) => {
      task.order = index;
    });
  }

  const days = new Map<IsoDate, Task[]>();
  for (const task of tasks) {
    if (!task.scheduledDate) {
      task.scheduledOrder = 0;
      continue;
    }
    const day = days.get(task.scheduledDate);
    if (day) day.push(task);
    else days.set(task.scheduledDate, [task]);
  }
  for (const day of days.values()) {
    day.sort((a, b) => a.scheduledOrder - b.scheduledOrder);
    day.forEach((task, index) => {
      task.scheduledOrder = index;
    });
  }

  return tasks;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** 定期の回を「個別に編集した」とみなす変更か */
function isContentChanged(before: AppEvent, after: AppEvent): boolean {
  return (
    before.title !== after.title ||
    before.note !== after.note ||
    before.date !== after.date ||
    before.endDate !== after.endDate ||
    before.allDay !== after.allDay ||
    before.startTime !== after.startTime ||
    before.endTime !== after.endTime
  );
}

function touch(task: Task): void {
  task.updatedAt = new Date().toISOString();
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...defaultAppData(),
      undoStack: [],
      toast: null,
      selectedTaskId: null,
      selectedEventId: null,
      selectedSeriesId: null,
      selectedMediaId: null,
      syncStatus: 'unknown',
      lastSavedAt: null,

      selectTask(id) {
        // 詳細パネルは 1 枚だけ。イベント側が開いていれば閉じる
        set({ selectedTaskId: id, selectedEventId: null, selectedSeriesId: null, selectedMediaId: null });
      },

      selectEvent(id) {
        set({ selectedEventId: id, selectedTaskId: null, selectedSeriesId: null, selectedMediaId: null });
      },

      selectSeries(id) {
        set({ selectedSeriesId: id, selectedTaskId: null, selectedEventId: null, selectedMediaId: null });
      },

      selectMedia(id) {
        set({ selectedMediaId: id, selectedTaskId: null, selectedEventId: null, selectedSeriesId: null });
      },

      setSync(status, lastSavedAt) {
        set(lastSavedAt === undefined ? { syncStatus: status } : { syncStatus: status, lastSavedAt });
      },

      hydrate(data) {
        set((current) => ({
          schemaVersion: SCHEMA_VERSION,
          tasks: normalizeOrders(data.tasks.map((t) => ({ ...t }))),
          tags: data.tags,
          // ファイルを直接書き換えた場合も、足りない定期の回はここで置く
          events: expandSeries(data.eventSeries, data.events, today()).events,
          eventSeries: data.eventSeries,
          mediaKinds: data.mediaKinds,
          media: data.media,
          settings: data.settings,
          // 表示中の画面は引き継ぐ（起動直後なので実質どちらでも同じ）
          ui: { ...data.ui, view: current.ui.view },
          undoStack: [],
          selectedTaskId: null,
          selectedEventId: null,
          selectedSeriesId: null,
          selectedMediaId: null,
        }));
      },

      addTask({ title, stage, parentId = null }) {
        const trimmed = title.trim();
        if (!trimmed) return '';
        const id = createId();
        set((state) => {
          const siblings = state.tasks.filter((t) =>
            parentId ? t.parentId === parentId : !t.parentId && t.stage === stage,
          );
          const task = makeTask({
            id,
            title: trimmed,
            stage,
            parentId,
            // 段階直下のタスクは列の先頭へ、サブタスクは末尾へ追加する
            order: parentId ? siblings.length : -1,
          });
          return { tasks: normalizeOrders([...state.tasks.map((t) => ({ ...t })), task]) };
        });
        return id;
      },

      updateTask(id, patch) {
        set((state) => ({
          tasks: state.tasks.map((task) => {
            if (task.id !== id) return task;
            const next = { ...task, ...patch, id: task.id };
            touch(next);
            return next;
          }),
        }));
      },

      deleteTask(id) {
        const state = get();
        const target = state.tasks.find((t) => t.id === id);
        if (!target) return;
        const removed = state.tasks.filter((t) => t.id === id || t.parentId === id);
        const removedCount = removed.length;
        // 完了済みのタスクは消さずに archive.json へ残す
        let archiveId: string | undefined;
        if (target.done) {
          const entry = makeArchiveEntry(removed, state, 'delete');
          archive(entry);
          archiveId = entry.id;
        }
        set((current) => ({
          undoStack: [...current.undoStack, { ...snapshotOf(current), archiveId }].slice(-UNDO_LIMIT),
          selectedTaskId: current.selectedTaskId === id ? null : current.selectedTaskId,
          tasks: normalizeOrders(
            current.tasks.filter((t) => t.id !== id && t.parentId !== id).map((t) => ({ ...t })),
          ),
        }));
        const verb = target.done ? 'アーカイブ' : '削除';
        get().showToast(
          removedCount > 1
            ? `「${target.title}」とサブタスク${removedCount - 1}件を${verb}しました`
            : `「${target.title}」を${verb}しました`,
          true,
        );
      },

      toggleDone(id) {
        set((state) => {
          const target = state.tasks.find((t) => t.id === id);
          if (!target) return {};
          const done = !target.done;
          const completedAt = done ? new Date().toISOString() : null;
          return {
            tasks: state.tasks.map((task) => {
              // 親を完了にしたらサブタスクも完了にする（戻すときは連動させない）
              const isTarget = task.id === id;
              const isChildOfCompleted = done && task.parentId === id && !task.done;
              if (!isTarget && !isChildOfCompleted) return task;
              const next = { ...task, done, completedAt };
              touch(next);
              return next;
            }),
          };
        });
      },

      adoptSortedOrder() {
        const { sortKey } = get().ui;
        if (sortKey === 'manual') return false;
        set((state) => {
          const tasks = state.tasks.map((t) => ({ ...t }));
          for (const stage of STAGES) {
            const top = topLevel(tasks, stage);
            // 完了済みは並べ替えの対象外なので、元の順のまま後ろに回す
            const ordered = [...sortTasks(top.filter((t) => !t.done), sortKey), ...top.filter((t) => t.done)];
            ordered.forEach((task, i) => {
              task.order = i;
            });
          }
          return { tasks, ui: { ...state.ui, sortKey: 'manual' } };
        });
        return true;
      },

      moveTask(activeId, target, position) {
        set((state) => {
          const tasks = state.tasks.map((t) => ({ ...t }));
          const active = tasks.find((t) => t.id === activeId);
          if (!active) return {};

          if (target.kind === 'day') {
            const day = tasks
              .filter((t) => t.scheduledDate === target.date && t.id !== activeId)
              .sort((a, b) => a.scheduledOrder - b.scheduledOrder);
            active.scheduledDate = target.date;
            touch(active);
            day.splice(insertIndex(day, position), 0, active);
            day.forEach((task, i) => {
              task.scheduledOrder = i;
            });
            return { tasks: normalizeOrders(tasks) };
          }

          if (target.kind === 'parent') {
            if (target.parentId === activeId) return {};
            const parent = tasks.find((t) => t.id === target.parentId);
            if (!parent) return {};
            // 孫は作らない。サブタスクの下に落とした場合はその親に入れる
            const parentId = parent.parentId ?? parent.id;
            // 自分の子を持ったまま子になれないので、子はトップレベルへ引き上げる
            for (const child of tasks) {
              if (child.parentId === activeId) {
                child.parentId = null;
                child.stage = active.stage;
                child.order = Number.MAX_SAFE_INTEGER;
              }
            }
            active.parentId = parentId;
            active.stage = tasks.find((t) => t.id === parentId)?.stage ?? active.stage;
            touch(active);
            const siblings = tasks
              .filter((t) => t.parentId === parentId && t.id !== activeId)
              .sort(byOrder);
            siblings.splice(insertIndex(siblings, position), 0, active);
            siblings.forEach((task, i) => {
              task.order = i;
            });
            return { tasks: normalizeOrders(tasks) };
          }

          // 段階カラムへの移動。サブタスクをここに落とすとトップレベルに昇格する
          active.parentId = null;
          active.stage = target.stage;
          touch(active);
          for (const child of tasks) {
            if (child.parentId === activeId) child.stage = target.stage;
          }
          const siblings = tasks
            .filter((t) => !t.parentId && t.stage === target.stage && t.id !== activeId)
            .sort(byOrder);
          siblings.splice(insertIndex(siblings, position), 0, active);
          siblings.forEach((task, i) => {
            task.order = i;
          });
          return { tasks: normalizeOrders(tasks) };
        });
      },

      unscheduleTask(id) {
        set((state) => ({
          tasks: normalizeOrders(
            state.tasks.map((task) =>
              task.id === id ? { ...task, scheduledDate: null, scheduledOrder: 0 } : { ...task },
            ),
          ),
        }));
      },

      unscheduleDay(date) {
        const count = get().tasks.filter((t) => t.scheduledDate === date).length;
        if (count === 0) return;
        set((state) => ({
          undoStack: [...state.undoStack, snapshotOf(state)].slice(-UNDO_LIMIT),
          tasks: normalizeOrders(
            state.tasks.map((task) =>
              task.scheduledDate === date
                ? { ...task, scheduledDate: null, scheduledOrder: 0 }
                : { ...task },
            ),
          ),
        }));
        get().showToast(`${count}件を未配置に戻しました`, true);
      },

      unscheduleOverdue() {
        const ids = new Set(overdueScheduled(get().tasks, today()).map((t) => t.id));
        if (ids.size === 0) return;
        set((state) => ({
          undoStack: [...state.undoStack, snapshotOf(state)].slice(-UNDO_LIMIT),
          tasks: normalizeOrders(
            state.tasks.map((task) =>
              ids.has(task.id) ? { ...task, scheduledDate: null, scheduledOrder: 0 } : { ...task },
            ),
          ),
        }));
        get().showToast(`昨日以前の未消化${ids.size}件を未配置に戻しました`, true);
      },

      addEvent({ title, date }) {
        const trimmed = title.trim();
        if (!trimmed) return '';
        const id = createId('e');
        set((state) => ({ events: [...state.events, makeEvent({ id, title: trimmed, date })] }));
        return id;
      },

      updateEvent(id, patch) {
        set((state) => ({
          // makeEvent を通して「終日なら時刻なし」「終了だけある状態を作らない」を保つ
          events: state.events.map((event) => {
            if (event.id !== id) return event;
            const next = makeEvent({
              ...event,
              ...patch,
              id: event.id,
              // 定期の回のどこと結びつくかは、ここからは変えさせない
              seriesId: event.seriesId,
              occurrenceDate: event.occurrenceDate,
              updatedAt: new Date().toISOString(),
            });
            // 中身を変えた回は、あとで定期を変えても追従させない
            if (next.seriesId && isContentChanged(event, next)) next.customized = true;
            return next;
          }),
        }));
      },

      deleteEvent(id) {
        const state = get();
        const target = state.events.find((e) => e.id === id);
        if (!target) return;
        if (target.seriesId) {
          get().setEventCancelled(id, true);
          return;
        }
        const linked = state.tasks.filter((t) => t.eventId === id).length;
        set((current) => ({
          undoStack: [...current.undoStack, snapshotOf(current)].slice(-UNDO_LIMIT),
          selectedEventId: current.selectedEventId === id ? null : current.selectedEventId,
          events: current.events.filter((e) => e.id !== id),
          // 紐づいていたタスクは消さず、紐づけだけ外す
          tasks: current.tasks.map((t) => (t.eventId === id ? { ...t, eventId: null } : t)),
        }));
        get().showToast(
          linked > 0
            ? `「${target.title}」を削除しました（タスク${linked}件の紐づけを外しました）`
            : `「${target.title}」を削除しました`,
          true,
        );
      },

      setEventCancelled(id, cancelled) {
        const target = get().events.find((e) => e.id === id);
        if (!target || target.cancelled === cancelled) return;
        set((state) => ({
          undoStack: [...state.undoStack, snapshotOf(state)].slice(-UNDO_LIMIT),
          events: state.events.map((event) =>
            event.id === id ? { ...event, cancelled, updatedAt: new Date().toISOString() } : event,
          ),
        }));
        get().showToast(
          cancelled ? `「${target.title}」を中止にしました` : `「${target.title}」の中止を取り消しました`,
          true,
        );
      },

      addSeries({ title, startDate }) {
        const trimmed = title.trim();
        if (!trimmed) return '';
        const series = makeEventSeries({ title: trimmed, startDate });
        set((state) => ({
          eventSeries: [...state.eventSeries, series],
          events: expandSeries([series], state.events, today()).events,
        }));
        return series.id;
      },

      updateSeries(id, patch) {
        set((state) => {
          const current = state.eventSeries.find((r) => r.id === id);
          if (!current) return {};
          const series = makeEventSeries({
            ...current,
            ...patch,
            id: current.id,
            createdAt: current.createdAt,
            updatedAt: new Date().toISOString(),
          });
          const changed = applySeriesChange(series, state.events, today());
          return {
            eventSeries: state.eventSeries.map((r) => (r.id === id ? series : r)),
            events: expandSeries([series], changed, today()).events,
          };
        });
      },

      deleteSeries(id) {
        const target = get().eventSeries.find((r) => r.id === id);
        if (!target) return;
        set((state) => ({
          undoStack: [...state.undoStack, snapshotOf(state)].slice(-UNDO_LIMIT),
          selectedSeriesId: state.selectedSeriesId === id ? null : state.selectedSeriesId,
          eventSeries: state.eventSeries.filter((r) => r.id !== id),
          events: detachSeries(id, state.events, today()),
        }));
        get().showToast(`定期「${target.title}」を削除しました（今日以降の回は中止にしました）`, true);
      },

      expandRecurring() {
        const state = get();
        const { events, added } = expandSeries(state.eventSeries, state.events, today());
        if (added > 0) set({ events });
        return added;
      },

      setTaskEvent(taskId, eventId) {
        set((state) => ({
          tasks: state.tasks.map((task) => {
            if (task.id !== taskId) return task;
            const valid = eventId && state.events.some((e) => e.id === eventId) ? eventId : null;
            const next = { ...task, eventId: valid };
            touch(next);
            return next;
          }),
        }));
      },

      addMedia({ title, kindId }) {
        const trimmed = title.trim();
        if (!trimmed) return '';
        const id = createId('m');
        set((state) => ({
          // 足したものは「気になる」の先頭に置く
          media: normalizeMediaOrders([
            ...state.media,
            makeMediaItem({
              id,
              title: trimmed,
              order: -1,
              kindId: kindId && state.mediaKinds.some((k) => k.id === kindId) ? kindId : null,
            }),
          ]),
        }));
        return id;
      },

      updateMedia(id, patch) {
        set((state) => ({
          // makeMediaItem を通して評価の範囲や状態の値を保つ
          media: state.media.map((item) =>
            item.id === id
              ? makeMediaItem({ ...item, ...patch, id: item.id, updatedAt: new Date().toISOString() })
              : item,
          ),
        }));
      },

      setMediaStatus(id, status) {
        const item = get().media.find((m) => m.id === id);
        if (!item || item.status === status) return;
        // ボタンで移したものは、移った先の列の先頭に置く
        get().moveMedia(id, status, 0);
      },

      moveMedia(activeId, status, position) {
        set((state) => {
          const items = state.media.map((m) => ({ ...m }));
          const active = items.find((m) => m.id === activeId);
          if (!active) return {};
          if (active.status !== status) {
            const now = today();
            // 再開や見直しで上書きしないよう、最初の 1 回だけ記録する
            if (status === 'playing' && !active.startedAt) active.startedAt = now;
            if (status === 'done' && !active.finishedAt) active.finishedAt = now;
            active.status = status;
            active.updatedAt = new Date().toISOString();
          }
          const siblings = items
            .filter((m) => m.status === status && m.id !== activeId)
            .sort((a, b) => a.order - b.order);
          siblings.splice(insertIndex(siblings, position), 0, active);
          siblings.forEach((item, i) => {
            item.order = i;
          });
          return { media: normalizeMediaOrders(items) };
        });
      },

      deleteMedia(id) {
        const target = get().media.find((m) => m.id === id);
        if (!target) return;
        set((current) => ({
          undoStack: [...current.undoStack, snapshotOf(current)].slice(-UNDO_LIMIT),
          selectedMediaId: current.selectedMediaId === id ? null : current.selectedMediaId,
          media: normalizeMediaOrders(current.media.filter((m) => m.id !== id)),
        }));
        get().showToast(`「${target.title}」を削除しました`, true);
      },

      addMediaKind(name) {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const existing = get().mediaKinds.find((kind) => kind.name === trimmed);
        if (existing) return existing.id;
        const id = createId('k');
        set((state) => ({
          mediaKinds: [
            ...state.mediaKinds,
            { id, name: trimmed, color: TAG_COLORS[state.mediaKinds.length % TAG_COLORS.length]! },
          ],
        }));
        return id;
      },

      updateMediaKind(id, patch) {
        set((state) => ({
          mediaKinds: state.mediaKinds.map((kind) => (kind.id === id ? { ...kind, ...patch, id } : kind)),
        }));
      },

      deleteMediaKind(id) {
        const target = get().mediaKinds.find((kind) => kind.id === id);
        if (!target) return;
        set((current) => ({
          undoStack: [...current.undoStack, snapshotOf(current)].slice(-UNDO_LIMIT),
          mediaKinds: current.mediaKinds.filter((kind) => kind.id !== id),
          // その種類だった娯楽は消さず、未分類にする
          media: current.media.map((item) =>
            item.kindId === id ? { ...item, kindId: null, updatedAt: new Date().toISOString() } : item,
          ),
          ui: {
            ...current.ui,
            filterMediaKindIds: current.ui.filterMediaKindIds.filter((k) => k !== id),
          },
        }));
        get().showToast(`種類「${target.name}」を削除しました`, true);
      },

      addTag(name) {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const existing = get().tags.find((tag) => tag.name === trimmed);
        if (existing) return existing.id;
        const id = createId('g');
        set((state) => ({
          tags: [
            ...state.tags,
            { id, name: trimmed, color: TAG_COLORS[state.tags.length % TAG_COLORS.length]! },
          ],
        }));
        return id;
      },

      updateTag(id, patch) {
        set((state) => ({
          tags: state.tags.map((tag) => (tag.id === id ? { ...tag, ...patch, id } : tag)),
        }));
      },

      deleteTag(id) {
        const target = get().tags.find((tag) => tag.id === id);
        if (!target) return;
        set((current) => ({
          undoStack: [...current.undoStack, snapshotOf(current)].slice(-UNDO_LIMIT),
          tags: current.tags.filter((tag) => tag.id !== id),
          tasks: current.tasks.map((task) => {
            if (!task.tagIds.includes(id)) return task;
            const next = { ...task, tagIds: task.tagIds.filter((t) => t !== id) };
            touch(next);
            return next;
          }),
          ui: { ...current.ui, filterTagIds: current.ui.filterTagIds.filter((t) => t !== id) },
        }));
        get().showToast(`タグ「${target.name}」を削除しました`, true);
      },

      toggleTaskTag(taskId, tagId) {
        set((state) => ({
          tasks: state.tasks.map((task) => {
            if (task.id !== taskId) return task;
            const tagIds = task.tagIds.includes(tagId)
              ? task.tagIds.filter((t) => t !== tagId)
              : [...task.tagIds, tagId];
            const next = { ...task, tagIds };
            touch(next);
            return next;
          }),
        }));
      },

      setUi(patch) {
        set((state) => ({ ui: { ...state.ui, ...patch } }));
      },

      setSettings(patch) {
        set((state) => ({ settings: { ...state.settings, ...patch } }));
      },

      replaceData(data, message) {
        set((current) => ({
          undoStack: [...current.undoStack, snapshotOf(current)].slice(-UNDO_LIMIT),
          selectedTaskId: null,
          selectedEventId: null,
          selectedSeriesId: null,
          selectedMediaId: null,
          schemaVersion: SCHEMA_VERSION,
          tasks: normalizeOrders(data.tasks.map((t) => ({ ...t }))),
          tags: data.tags,
          events: data.events,
          eventSeries: data.eventSeries,
          mediaKinds: data.mediaKinds,
          media: data.media,
          settings: data.settings,
          ui: { ...data.ui, view: current.ui.view },
        }));
        get().showToast(message, true);
      },

      clearCompleted() {
        const state = get();
        const doneIds = new Set(state.tasks.filter((t) => t.done).map((t) => t.id));
        if (doneIds.size === 0) return;
        const isRemoved = (t: Task) => doneIds.has(t.id) || (t.parentId !== null && doneIds.has(t.parentId));
        // 消すものは archive.json へ残す（完了済みの親に付いていた未完了の子も一緒に）
        const entry = makeArchiveEntry(state.tasks.filter(isRemoved), state, 'clear-completed');
        archive(entry);
        set((current) => ({
          undoStack: [...current.undoStack, { ...snapshotOf(current), archiveId: entry.id }].slice(
            -UNDO_LIMIT,
          ),
          selectedTaskId: null,
          tasks: normalizeOrders(current.tasks.filter((t) => !isRemoved(t)).map((t) => ({ ...t }))),
        }));
        get().showToast(`完了済み${doneIds.size}件をアーカイブしました`, true);
      },

      undo() {
        const stack = get().undoStack;
        const previous = stack[stack.length - 1];
        if (!previous) return;
        if (previous.archiveId) unarchive(previous.archiveId);
        set((current) => ({
          undoStack: stack.slice(0, -1),
          tasks: previous.tasks,
          tags: previous.tags,
          events: previous.events,
          eventSeries: previous.eventSeries,
          mediaKinds: previous.mediaKinds,
          media: previous.media,
          settings: previous.settings,
          ui: { ...previous.ui, view: current.ui.view },
          toast: { id: createId('toast'), message: '元に戻しました', undoable: false },
        }));
      },

      showToast(message, undoable = false) {
        set({ toast: { id: createId('toast'), message, undoable } });
      },

      dismissToast() {
        set({ toast: null });
      },
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      migrate: (persisted, version) => migrate(persisted, version) as never,
      partialize: (state) => persistedData(state),
    },
  ),
);

/**
 * 保存対象として切り出した形。localStorage・ファイル・エクスポートで同じものを使う。
 * 検索語だけは、次に開いたときタスクが消えて見えないよう落とす。
 */
export function persistedData(state: AppData): AppData {
  return {
    schemaVersion: state.schemaVersion,
    tasks: state.tasks,
    tags: state.tags,
    events: state.events,
    eventSeries: state.eventSeries,
    mediaKinds: state.mediaKinds,
    media: state.media,
    settings: state.settings,
    ui: { ...state.ui, search: '' },
  };
}

/** エクスポートやテストで使う、現在の永続化対象データ */
export function currentAppData(): AppData {
  return persistedData(useAppStore.getState());
}
