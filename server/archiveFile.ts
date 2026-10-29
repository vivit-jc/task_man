import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const ARCHIVE_FILE = 'archive.json';

/**
 * 1 回の削除でアーカイブに残したもの。
 * 中身（tasks など）はクライアントが決めるので、サーバーは id だけ見て素通しする。
 */
export interface ArchiveEntry {
  id: string;
  archivedAt: string;
  [key: string]: unknown;
}

export function isArchiveEntry(value: unknown): value is ArchiveEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string' && entry.id !== '' && typeof entry.archivedAt === 'string';
}

export async function readArchive(dir: string): Promise<ArchiveEntry[]> {
  const file = join(dir, ARCHIVE_FILE);
  if (!existsSync(file)) return [];
  const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error(`${ARCHIVE_FILE} が配列になっていません`);
  return parsed as ArchiveEntry[];
}

async function writeArchive(dir: string, entries: ArchiveEntry[]): Promise<void> {
  await mkdir(dir, { recursive: true });
  const file = join(dir, ARCHIVE_FILE);
  const temp = join(dir, `.${ARCHIVE_FILE}.${process.pid}.tmp`);
  await writeFile(temp, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
  await rename(temp, file);
}

/** 読んで足して書く間に別の書き込みが割り込まないよう、ディレクトリごとに順番に処理する */
const queues = new Map<string, Promise<unknown>>();

function serialize<T>(dir: string, job: () => Promise<T>): Promise<T> {
  const previous = queues.get(dir) ?? Promise.resolve();
  const next = previous.then(job, job);
  queues.set(dir, next.catch(() => undefined));
  return next;
}

/**
 * archive.json の末尾に足す。同じ id がすでにあれば足さない
 * （送信に失敗したと思って送り直したものが二重にならないように）。
 */
export function appendArchive(dir: string, incoming: ArchiveEntry[]): Promise<number> {
  return serialize(dir, async () => {
    const entries = await readArchive(dir);
    const known = new Set(entries.map((e) => e.id));
    const added = incoming.filter((e) => !known.has(e.id));
    if (added.length > 0) await writeArchive(dir, [...entries, ...added]);
    return added.length;
  });
}

/** 取り消されたときに、そのとき足した分だけ外す */
export function removeArchive(dir: string, id: string): Promise<boolean> {
  return serialize(dir, async () => {
    const entries = await readArchive(dir);
    const rest = entries.filter((e) => e.id !== id);
    if (rest.length === entries.length) return false;
    await writeArchive(dir, rest);
    return true;
  });
}
