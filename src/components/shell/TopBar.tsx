import { useRef, useState } from 'react';
import { currentAppData, useAppStore } from '../../store/useAppStore';
import {
  ImportError,
  downloadJson,
  exportFileName,
  parseImportText,
  toExportJson,
} from '../../store/transfer';
import type { AppData, Theme, View } from '../../types';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SaveIndicator } from './SaveIndicator';

const VIEW_TABS: { id: View; label: string; hint: string }[] = [
  { id: 'board', label: 'ボード', hint: '1' },
  { id: 'week', label: '週', hint: '2' },
  { id: 'month', label: '月', hint: '3' },
  { id: 'event', label: 'イベント', hint: '4' },
  { id: 'media', label: 'たのしみ', hint: '5' },
];

const SEARCH_TARGET: Partial<Record<View, string>> = { event: 'イベント', media: 'たのしみ' };

const THEME_LABEL: Record<Theme, string> = { system: '自動', light: '明', dark: '暗' };

interface Props {
  searchRef: React.RefObject<HTMLInputElement>;
}

export function TopBar({ searchRef }: Props) {
  const view = useAppStore((s) => s.ui.view);
  const search = useAppStore((s) => s.ui.search);
  const theme = useAppStore((s) => s.settings.theme);
  const setUi = useAppStore((s) => s.setUi);
  const setSettings = useAppStore((s) => s.setSettings);
  const replaceData = useAppStore((s) => s.replaceData);
  const showToast = useAppStore((s) => s.showToast);

  const searchTarget = SEARCH_TARGET[view] ?? 'タスク';
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ data: AppData; fileName: string } | null>(null);

  const handleExport = () => {
    downloadJson(toExportJson(currentAppData()), exportFileName());
    showToast('現在の状態をエクスポートしました');
  };

  const handleFile = async (file: File) => {
    try {
      const data = parseImportText(await file.text());
      setPending({ data, fileName: file.name });
    } catch (error) {
      showToast(
        error instanceof ImportError ? error.message : 'ファイルを読み込めませんでした。',
      );
    }
  };

  const cycleTheme = () => {
    const order: Theme[] = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(theme) + 1) % order.length]!;
    setSettings({ theme: next });
  };

  return (
    <header className="topbar">
      <div className="brand">task_man</div>

      <nav className="view-tabs" aria-label="表示切り替え">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`view-tab${view === tab.id ? ' is-active' : ''}`}
            onClick={() => setUi({ view: tab.id })}
            aria-current={view === tab.id}
            title={`${tab.label}（${tab.hint}）`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="topbar-spacer" />

      <input
        ref={searchRef}
        className="field search"
        type="search"
        value={search}
        placeholder={`${searchTarget}を検索（/）`}
        onChange={(e) => setUi({ search: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setUi({ search: '' });
        }}
        aria-label={`${searchTarget}を検索`}
      />

      <SaveIndicator />

      <button type="button" className="btn btn-quiet" onClick={cycleTheme} title="表示テーマ">
        テーマ {THEME_LABEL[theme]}
      </button>
      <button type="button" className="btn" onClick={handleExport}>
        エクスポート
      </button>
      <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
        インポート
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />

      {pending && (
        <ConfirmDialog
          title="バックアップを読み込む"
          body={`${pending.fileName} のタスク${pending.data.tasks.length}件・イベント${pending.data.events.length}件・たのしみ${pending.data.media.length}件で現在のデータを置き換えます。読み込んだ後でも「元に戻す」で戻せます。`}
          confirmLabel="読み込む"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            replaceData(pending.data, `${pending.fileName} を読み込みました`);
            setPending(null);
          }}
        />
      )}
    </header>
  );
}
