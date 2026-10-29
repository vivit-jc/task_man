import type { AppEvent, Tag, Task } from '../types';
import { createId } from '../lib/id';

const ENDPOINT = '/api/archive';
/** まだファイルへ送れていないアーカイブ。静的配信のときはここがそのままアーカイブになる */
export const PENDING_KEY = 'task_man.archive.pending';
/** 失敗したときに再び試すまでの待ち時間 */
const RETRY_MS = 5000;

export type ArchiveReason = 'clear-completed' | 'delete';

/**
 * 削除した完了済みタスクの記録。archive.json に 1 回の削除につき 1 件ずつ足していく。
 * タグやイベントはあとで消えても読めるよう、そのとき参照していたものを写しておく。
 */
export interface ArchiveEntry {
  id: string;
  archivedAt: string;
  reason: ArchiveReason;
  tasks: Task[];
  tags: Tag[];
  events: AppEvent[];
}

export function makeArchiveEntry(
  tasks: Task[],
  context: { tags: Tag[]; events: AppEvent[] },
  reason: ArchiveReason,
  now = new Date(),
): ArchiveEntry {
  const tagIds = new Set(tasks.flatMap((t) => t.tagIds));
  const eventIds = new Set(tasks.map((t) => t.eventId).filter((id): id is string => id !== null));
  return {
    id: createId('archive'),
    archivedAt: now.toISOString(),
    reason,
    tasks: tasks.map((t) => ({ ...t, tagIds: [...t.tagIds] })),
    tags: context.tags.filter((t) => tagIds.has(t.id)).map((t) => ({ ...t })),
    events: context.events.filter((e) => eventIds.has(e.id)).map((e) => ({ ...e })),
  };
}

function readPending(): ArchiveEntry[] {
  try {
    const raw = globalThis.localStorage?.getItem(PENDING_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ArchiveEntry[]) : [];
  } catch {
    return [];
  }
}

function writePending(entries: ArchiveEntry[]): void {
  try {
    if (entries.length === 0) globalThis.localStorage?.removeItem(PENDING_KEY);
    else globalThis.localStorage?.setItem(PENDING_KEY, JSON.stringify(entries));
  } catch {
    // 容量超過などで書けなくても、削除の操作そのものは止めない
  }
}

/** ファイルへ送れるか（npm run dev で動かしているか） */
let available = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
/** 追記と取り消しが入れ違わないよう、サーバーへの送信は 1 本の列で順に流す */
let chain: Promise<void> = Promise.resolve();

function enqueue(job: () => Promise<void>): void {
  chain = chain.then(job).catch(() => {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(flush, RETRY_MS);
  });
}

function flush(): void {
  if (!available) return;
  enqueue(async () => {
    const pending = readPending();
    if (pending.length === 0) return;
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pending),
    });
    if (!res.ok) throw new Error(String(res.status));
    // 送っている間に足されたものは残す
    const sent = new Set(pending.map((e) => e.id));
    writePending(readPending().filter((e) => !sent.has(e.id)));
  });
}

/** アーカイブに足す。まず localStorage に置き、送れたら消す */
export function archive(entry: ArchiveEntry): void {
  writePending([...readPending(), entry]);
  flush();
}

/** 削除が取り消されたとき、そのとき足した分を外す */
export function unarchive(id: string): void {
  writePending(readPending().filter((e) => e.id !== id));
  if (!available) return;
  // 送信中だった場合に備えて、列の後ろで消す（無ければ何もしない）
  enqueue(async () => {
    const res = await fetch(`${ENDPOINT}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(String(res.status));
  });
}

/** 保存 API が使えるときに呼ぶ。前回送れなかった分もここで送る */
export function startArchiveSync(): void {
  available = true;
  flush();
}
