import { existsSync, statSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { toIsoDate } from '../src/lib/date';

export const STATE_FILE = 'state.json';
export const HISTORY_DIR = 'history';

/** 日次スナップショットを残す上限。超えた分は古いものから消す */
export const HISTORY_LIMIT = 60;

/** ファイルが別の場所で書き換えられていたことを表す */
export class ConflictError extends Error {
  constructor(readonly revision: string | null) {
    super('ファイルが別の場所で更新されています');
  }
}

export interface ReadResult {
  text: string;
  /** ファイルの版。更新時刻をそのまま使う */
  revision: string;
}

export interface WriteResult {
  savedAt: string;
  revision: string;
  /** その日の最初の保存で作られたスナップショットのファイル名 */
  snapshot: string | null;
}

function revisionOf(file: string): string | null {
  if (!existsSync(file)) return null;
  return String(statSync(file).mtimeMs);
}

export async function readState(dir: string): Promise<ReadResult | null> {
  const file = join(dir, STATE_FILE);
  const revision = revisionOf(file);
  if (revision === null) return null;
  return { text: await readFile(file, 'utf8'), revision };
}

/**
 * state.json を書き換える。
 * 書き込み途中で落ちても壊れたファイルが残らないよう、一時ファイルに書いてから差し替える。
 *
 * expectedRevision を渡すと、その版から変わっていたときに ConflictError を投げる。
 * エディタで直接編集したものを、開きっぱなしのタブが黙って巻き戻すのを防ぐため。
 *
 * その日まだスナップショットが無ければ、同じ内容を history にも残す
 * （その日の最初の保存 ≒ 前日の終了時点なので、事故ったとき前日に戻れる）。
 */
export async function writeState(
  dir: string,
  text: string,
  now: Date,
  expectedRevision?: string | null,
): Promise<WriteResult> {
  await mkdir(dir, { recursive: true });
  const file = join(dir, STATE_FILE);

  if (expectedRevision !== undefined) {
    const current = revisionOf(file);
    if (current !== expectedRevision) throw new ConflictError(current);
  }

  const temp = join(dir, `.${STATE_FILE}.${process.pid}.tmp`);
  await writeFile(temp, text, 'utf8');
  await rename(temp, file);

  const historyDir = join(dir, HISTORY_DIR);
  const snapshot = join(historyDir, `state-${toIsoDate(now)}.json`);
  let created: string | null = null;
  if (!existsSync(snapshot)) {
    await mkdir(historyDir, { recursive: true });
    await writeFile(snapshot, text, 'utf8');
    created = basename(snapshot);
    await pruneHistory(historyDir, HISTORY_LIMIT);
  }

  return { savedAt: now.toISOString(), revision: revisionOf(file) ?? '', snapshot: created };
}

/** 古いスナップショットを消す。残す数は新しい方から keep 件 */
export async function pruneHistory(historyDir: string, keep: number): Promise<string[]> {
  if (!existsSync(historyDir)) return [];
  const files = (await readdir(historyDir))
    .filter((name) => /^state-\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort();
  const removed = files.slice(0, Math.max(files.length - keep, 0));
  await Promise.all(removed.map((name) => rm(join(historyDir, name), { force: true })));
  return removed;
}
