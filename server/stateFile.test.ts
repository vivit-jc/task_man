import { mkdtemp, readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ConflictError, HISTORY_DIR, pruneHistory, readState, writeState } from './stateFile';

const dirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'task-man-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  dirs.length = 0;
});

describe('state.json への保存', () => {
  it('保存した内容をそのまま読み戻せる', async () => {
    const dir = await tempDir();
    expect(await readState(dir)).toBeNull();

    await writeState(dir, '{"tasks":[]}', new Date('2026-09-19T10:00:00'));
    expect((await readState(dir))?.text).toBe('{"tasks":[]}');
  });

  it('その日の最初の保存だけスナップショットを残す', async () => {
    const dir = await tempDir();
    const first = await writeState(dir, '{"n":1}', new Date('2026-09-19T09:00:00'));
    const second = await writeState(dir, '{"n":2}', new Date('2026-09-19T18:00:00'));
    const nextDay = await writeState(dir, '{"n":3}', new Date('2026-09-20T09:00:00'));

    expect(first.snapshot).toBe('state-2026-09-19.json');
    expect(second.snapshot).toBeNull();
    expect(nextDay.snapshot).toBe('state-2026-09-20.json');

    // スナップショットはその日の最初の内容のまま
    const kept = await readFile(join(dir, HISTORY_DIR, 'state-2026-09-19.json'), 'utf8');
    expect(kept).toBe('{"n":1}');
    // state.json は最新
    expect((await readState(dir))?.text).toBe('{"n":3}');
  });

  it('一時ファイルを残さない', async () => {
    const dir = await tempDir();
    await writeState(dir, '{"n":1}', new Date('2026-09-19T09:00:00'));
    const files = await readdir(dir);
    expect(files.filter((f) => f.includes('tmp'))).toHaveLength(0);
  });
});

describe('別の場所で書き換えられたとき', () => {
  it('把握している版と違えば上書きせずに知らせる', async () => {
    const dir = await tempDir();
    const first = await writeState(dir, '{"n":1}', new Date('2026-09-19T09:00:00'));

    // エディタなどがファイルを差し替えた状況を作る
    await writeState(dir, '{"n":"edited"}', new Date('2026-09-19T09:30:00'));

    await expect(
      writeState(dir, '{"n":2}', new Date('2026-09-19T10:00:00'), first.revision),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await readState(dir))?.text).toBe('{"n":"edited"}');
  });

  it('把握している版と一致すれば書き込める', async () => {
    const dir = await tempDir();
    const first = await writeState(dir, '{"n":1}', new Date('2026-09-19T09:00:00'));
    await writeState(dir, '{"n":2}', new Date('2026-09-19T10:00:00'), first.revision);
    expect((await readState(dir))?.text).toBe('{"n":2}');
  });

  it('ファイルがまだ無い前提の書き込みは通る', async () => {
    const dir = await tempDir();
    await writeState(dir, '{"n":1}', new Date('2026-09-19T09:00:00'), null);
    expect((await readState(dir))?.text).toBe('{"n":1}');
  });
});

describe('古いスナップショットの整理', () => {
  it('新しい方から指定件数だけ残す', async () => {
    const dir = await tempDir();
    const historyDir = join(dir, HISTORY_DIR);
    await mkdir(historyDir, { recursive: true });
    for (const day of ['01', '02', '03', '04', '05']) {
      await writeFile(join(historyDir, `state-2026-09-${day}.json`), '{}', 'utf8');
    }
    await writeFile(join(historyDir, 'notes.txt'), 'x', 'utf8');

    const removed = await pruneHistory(historyDir, 3);

    expect(removed).toEqual(['state-2026-09-01.json', 'state-2026-09-02.json']);
    const rest = (await readdir(historyDir)).sort();
    // 関係ないファイルには触らない
    expect(rest).toEqual([
      'notes.txt',
      'state-2026-09-03.json',
      'state-2026-09-04.json',
      'state-2026-09-05.json',
    ]);
  });
});
