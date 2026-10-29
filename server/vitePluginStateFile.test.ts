import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveDataDir } from './vitePluginStateFile';

describe('データの置き場所', () => {
  it('相対パスはプロジェクトルートから', () => {
    expect(resolveDataDir('/work/task_man', 'data')).toBe('/work/task_man/data');
  });

  it('絶対パスはそのまま', () => {
    expect(resolveDataDir('/work/task_man', '/srv/tasks')).toBe('/srv/tasks');
  });

  it('~ はホームに展開する', () => {
    expect(resolveDataDir('/work/task_man', '~/TaskManData')).toBe(join(homedir(), 'TaskManData'));
    expect(resolveDataDir('/work/task_man', '~')).toBe(homedir());
  });
});
