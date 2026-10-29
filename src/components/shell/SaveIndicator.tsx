import { overwriteStateFile } from '../../store/fileSync';
import { useAppStore } from '../../store/useAppStore';

const LABEL = {
  unknown: '確認中',
  off: 'ブラウザ内に保存',
  saving: '保存中',
  saved: 'ファイルに保存',
  error: '保存できません',
  conflict: 'ファイルが更新されています',
} as const;

/** データがどこに保存されているかを常に見えるところに出しておく */
export function SaveIndicator() {
  const status = useAppStore((s) => s.syncStatus);
  const lastSavedAt = useAppStore((s) => s.lastSavedAt);

  const time = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    : null;

  const title =
    status === 'off'
      ? 'npm run dev で起動すると data/state.json にも自動保存されます'
      : status === 'error'
        ? '開発サーバーが動いているか確認してください。変更はブラウザ内には残っています'
        : status === 'conflict'
          ? 'data/state.json が別の場所で書き換えられたため、上書きを止めています'
          : 'data/state.json に自動保存しています';

  return (
    <span className={`save-indicator is-${status}`} title={title}>
      <span className="save-dot" aria-hidden="true" />
      {LABEL[status]}
      {status === 'saved' && time && <span className="save-time num"> {time}</span>}
      {status === 'conflict' && (
        <>
          <button
            type="button"
            className="btn btn-sm"
            title="ファイルの内容で画面を読み直します。この画面での変更は失われます"
            onClick={() => window.location.reload()}
          >
            ファイルを読む
          </button>
          <button
            type="button"
            className="btn btn-sm"
            title="この画面の内容でファイルを書き換えます。ファイル側の変更は失われます"
            onClick={overwriteStateFile}
          >
            こちらで上書き
          </button>
        </>
      )}
    </span>
  );
}
