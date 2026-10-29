/**
 * 定期イベントの回を state.json に置く。taskman がアプリを開く前に呼ぶ（npm run expand）。
 *
 * アプリも起動時に同じことをするが、カレンダーへの同期（calsync）はアプリより先に走るので、
 * ここで置いておかないと新しい回がその日のうちにカレンダーへ入らない。
 * 回の id は定期と日付から決まるので、アプリ側と両方で置いても二重にはならない。
 *
 * 足すものが無ければ書き込まない。アプリが開いたままでも、そのときだけ競合で済む。
 */
import { loadEnv } from 'vite';
import { resolveDataDir } from '../server/vitePluginStateFile';
import { ConflictError, readState, writeState } from '../server/stateFile';
import { parseAppData } from '../src/store/persist';
import { toExportJson } from '../src/store/transfer';
import { expandSeries } from '../src/lib/recurrence';
import { today } from '../src/lib/date';

async function main() {
  const root = process.cwd();
  const env = { ...loadEnv('development', root, 'TASK_MAN_'), ...process.env };
  const dir = resolveDataDir(root, env.TASK_MAN_DATA_DIR || 'data');

  const current = await readState(dir);
  if (!current) {
    console.log(`state.json がまだありません（${dir}）。定期の展開は飛ばします。`);
    return;
  }

  const data = parseAppData(JSON.parse(current.text));
  const { events, added } = expandSeries(data.eventSeries, data.events, today());
  if (added === 0) return;

  try {
    await writeState(dir, toExportJson({ ...data, events }), new Date(), current.revision);
  } catch (error) {
    if (error instanceof ConflictError) {
      console.error('state.json が読み込み中に書き換えられたため、定期の展開を見送りました。');
      process.exitCode = 1;
      return;
    }
    throw error;
  }
  console.log(`定期イベントの回を ${added} 件置きました。`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
