import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARCHIVE_FILE, appendArchive, isArchiveEntry, readArchive, removeArchive } from './archiveFile';

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'task-man-archive-'));
}

const entry = (id: string) => ({ id, archivedAt: '2026-10-10T10:00:00.000Z', tasks: [{ id: `t-${id}` }] });

describe('archive.json への追記', () => {
  it('ファイルが無ければ作り、あとから足した分は末尾に並ぶ', async () => {
    const dir = await tempDir();
    expect(await readArchive(dir)).toEqual([]);

    await appendArchive(dir, [entry('a')]);
    await appendArchive(dir, [entry('b'), entry('c')]);

    expect((await readArchive(dir)).map((e) => e.id)).toEqual(['a', 'b', 'c']);
    // 人が読める形で書く
    expect(await readFile(join(dir, ARCHIVE_FILE), 'utf8')).toContain('\n  {');
  });

  it('同じ id を送り直しても二重にならない', async () => {
    const dir = await tempDir();
    expect(await appendArchive(dir, [entry('a')])).toBe(1);
    expect(await appendArchive(dir, [entry('a'), entry('b')])).toBe(1);
    expect((await readArchive(dir)).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('同時に送られても取りこぼさない', async () => {
    const dir = await tempDir();
    await Promise.all(['a', 'b', 'c', 'd'].map((id) => appendArchive(dir, [entry(id)])));
    expect((await readArchive(dir)).map((e) => e.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('取り消された分だけ外す', async () => {
    const dir = await tempDir();
    await appendArchive(dir, [entry('a'), entry('b')]);
    expect(await removeArchive(dir, 'a')).toBe(true);
    expect(await removeArchive(dir, 'missing')).toBe(false);
    expect((await readArchive(dir)).map((e) => e.id)).toEqual(['b']);
  });

  it('一時ファイルを残さない', async () => {
    const dir = await tempDir();
    await appendArchive(dir, [entry('a')]);
    expect((await readdir(dir)).filter((f) => f.includes('tmp'))).toHaveLength(0);
  });

  it('id と archivedAt が無いものは受け付けない', () => {
    expect(isArchiveEntry(entry('a'))).toBe(true);
    expect(isArchiveEntry({ id: '', archivedAt: 'x' })).toBe(false);
    expect(isArchiveEntry({ id: 'a' })).toBe(false);
    expect(isArchiveEntry([entry('a')])).toBe(false);
  });
});
