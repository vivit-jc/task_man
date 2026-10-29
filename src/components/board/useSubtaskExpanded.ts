import { useCallback, useSyncExternalStore } from 'react';

/**
 * ボードのサブタスク開閉状態。表示だけの好みなのでタスクデータには入れず localStorage に持つ。
 * 既定は閉じた状態で、開いている親タスクの id だけを記録する。
 */
const STORAGE_KEY = 'task_man.board.expandedSubtasks';

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

let expanded = load();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setExpanded(id: string, open: boolean): void {
  const next = new Set(expanded);
  if (open) next.add(id);
  else next.delete(id);
  expanded = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // 保存できなくても今の画面での開閉は効かせる
  }
  listeners.forEach((l) => l());
}

export function useSubtaskExpanded(taskId: string): [boolean, (open: boolean) => void] {
  const open = useSyncExternalStore(subscribe, () => expanded.has(taskId));
  const set = useCallback((next: boolean) => setExpanded(taskId, next), [taskId]);
  return [open, set];
}
