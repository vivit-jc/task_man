import type { AppData } from '../types';
import { parseAppData } from './persist';
import { toExportJson } from './transfer';
import { persistedData, useAppStore } from './useAppStore';

const ENDPOINT = '/api/state';
/** dev サーバーのプラグインが付ける印。静的配信の 404 と区別する */
const MARKER_HEADER = 'x-task-man-state';
const REVISION_HEADER = 'x-task-man-revision';

/** 競合したときに、画面側の内容でファイルを上書きし直す */
let overwrite: (() => void) | null = null;

export function overwriteStateFile(): void {
  overwrite?.();
}

/** 連続した変更をまとめて 1 回に */
const DEBOUNCE_MS = 800;
/** 失敗したときに再び試すまでの待ち時間 */
const RETRY_MS = 5000;

export interface LoadResult {
  /** 保存 API が使えるか（npm run dev で動かしているか） */
  available: boolean;
  /** ファイルに入っていたデータ。まだ無ければ null */
  data: AppData | null;
  revision: string | null;
}

export async function loadStateFile(): Promise<LoadResult> {
  try {
    const res = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } });
    const available = res.headers.get(MARKER_HEADER) === '1';
    const revision = res.headers.get(REVISION_HEADER);
    if (!available || !res.ok) return { available, data: null, revision: null };
    return { available, data: parseAppData(await res.json()), revision };
  } catch {
    // dev サーバーが落ちている、もしくは静的配信
    return { available: false, data: null, revision: null };
  }
}

/**
 * 状態が変わるたびに data/state.json へ書き戻す。
 *
 * 送るのは中身が実際に変わったときだけ。ファイルを直接編集したあとにタブを閉じても、
 * 何も操作していなければ古い状態で上書きしない。
 */
export function startFileSync(initialRevision: string | null): () => void {
  let timer: number | undefined;
  let saving = false;
  let dirty = false;
  let revision = initialRevision;
  /** 最後にファイルへ送った内容。比較用なので exportedAt は含めない */
  let saved: string | null = null;

  const current = () => {
    const data = persistedData(useAppStore.getState());
    return { data, key: JSON.stringify(data) };
  };

  const schedule = (delay: number) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = undefined;
      void flush();
    }, delay);
  };

  const flush = async () => {
    if (saving) {
      dirty = true;
      return;
    }
    const { data, key } = current();
    if (key === saved) {
      dirty = false;
      return;
    }

    saving = true;
    dirty = false;
    const store = useAppStore.getState();
    store.setSync('saving');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          [REVISION_HEADER]: revision ?? '',
        },
        body: toExportJson(data),
      });
      if (res.status === 409) {
        // ファイルが別の場所で書き換えられている。上書きせず読み直しを促す
        useAppStore.getState().setSync('conflict');
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      revision = res.headers.get(REVISION_HEADER) ?? revision;
      saved = key;
      useAppStore.getState().setSync('saved', new Date().toISOString());
    } catch {
      useAppStore.getState().setSync('error');
      dirty = true;
      schedule(RETRY_MS);
    } finally {
      saving = false;
      if (dirty) schedule(DEBOUNCE_MS);
    }
  };

  const unsubscribe = useAppStore.subscribe((state, previous) => {
    const changed =
      state.tasks !== previous.tasks ||
      state.tags !== previous.tags ||
      state.events !== previous.events ||
      state.eventSeries !== previous.eventSeries ||
      state.mediaKinds !== previous.mediaKinds ||
      state.media !== previous.media ||
      state.settings !== previous.settings ||
      state.ui !== previous.ui;
    if (changed && state.syncStatus !== 'conflict') schedule(DEBOUNCE_MS);
  });

  // タブを閉じる直前に、まだ送っていない変更を取りこぼさない
  const onHide = () => {
    window.clearTimeout(timer);
    timer = undefined;
    if (useAppStore.getState().syncStatus === 'conflict') return;
    const { data, key } = current();
    if (key === saved) return;
    navigator.sendBeacon(ENDPOINT, new Blob([toExportJson(data)], { type: 'application/json' }));
  };
  window.addEventListener('pagehide', onHide);

  // 競合を「こちらで上書き」で抜けるとき用。最新の版を取り直してから送り直す
  overwrite = () => {
    void (async () => {
      try {
        const res = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } });
        revision = res.headers.get(REVISION_HEADER) ?? null;
      } catch {
        // 取れなければ今持っている版のまま試す
      }
      saved = null;
      useAppStore.getState().setSync('saving');
      schedule(0);
    })();
  };

  // 起動直後に 1 回書いて、その日のスナップショットを作っておく
  schedule(0);

  return () => {
    window.clearTimeout(timer);
    window.removeEventListener('pagehide', onHide);
    unsubscribe();
    overwrite = null;
  };
}
