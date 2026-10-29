import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { formatMonthDay } from '../../lib/date';
import { MEDIA_STATUSES, MEDIA_STATUS_LABEL } from '../../types';
import { RatingStars } from './RatingStars';

export function MediaEditorPanel() {
  const selectedMediaId = useAppStore((s) => s.selectedMediaId);
  const item = useAppStore((s) => s.media.find((m) => m.id === s.selectedMediaId) ?? null);
  const mediaKinds = useAppStore((s) => s.mediaKinds);
  const selectMedia = useAppStore((s) => s.selectMedia);
  const updateMedia = useAppStore((s) => s.updateMedia);
  const setMediaStatus = useAppStore((s) => s.setMediaStatus);
  const deleteMedia = useAppStore((s) => s.deleteMedia);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectMedia(null);
    };
    if (selectedMediaId) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedMediaId, selectMedia]);

  if (!item) return null;

  const stamps = [
    item.startedAt && `開始 ${formatMonthDay(item.startedAt)}`,
    item.finishedAt && `済 ${formatMonthDay(item.finishedAt)}`,
  ].filter(Boolean);

  return (
    <aside className="editor" aria-label="たのしみの詳細">
      <div className="editor-head">
        <h2 className="editor-title">たのしみの詳細</h2>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => selectMedia(null)}>
          閉じる
        </button>
      </div>

      <div className="editor-body">
        <label className="label" htmlFor="media-title">
          タイトル
        </label>
        <input
          id="media-title"
          className="field"
          value={item.title}
          onChange={(e) => updateMedia(item.id, { title: e.target.value })}
        />

        <label className="label" htmlFor="media-kind">
          種類
        </label>
        <select
          id="media-kind"
          className="field"
          value={item.kindId ?? ''}
          onChange={(e) => updateMedia(item.id, { kindId: e.target.value || null })}
        >
          {mediaKinds.map((kind) => (
            <option key={kind.id} value={kind.id}>
              {kind.name}
            </option>
          ))}
          <option value="">未分類</option>
        </select>
        <p className="hint">種類の追加・名前の変更は、上の「種類を編集」からできます</p>

        <span className="label">状態</span>
        <div className="segmented media-status-picker" role="group" aria-label="状態">
          {MEDIA_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={item.status === status ? 'is-active' : ''}
              onClick={() => setMediaStatus(item.id, status)}
            >
              {MEDIA_STATUS_LABEL[status]}
            </button>
          ))}
        </div>
        {stamps.length > 0 && <p className="hint num">{stamps.join(' ・ ')}</p>}

        <label className="label" htmlFor="media-progress">
          どこまで
        </label>
        <input
          id="media-progress"
          className="field"
          placeholder="4章まで、S2E5、ボス手前 など"
          value={item.progress}
          onChange={(e) => updateMedia(item.id, { progress: e.target.value })}
        />

        <label className="label" htmlFor="media-where">
          どこで
        </label>
        <input
          id="media-where"
          className="field"
          placeholder="Netflix、Switch、積読の棚 など"
          value={item.where}
          onChange={(e) => updateMedia(item.id, { where: e.target.value })}
        />

        <span className="label">評価</span>
        <RatingStars value={item.rating} onChange={(rating) => updateMedia(item.id, { rating })} />
        <p className="hint">同じ星をもう一度押すと外せます</p>

        <label className="label" htmlFor="media-note">
          メモ
        </label>
        <textarea
          id="media-note"
          className="field"
          rows={4}
          placeholder="誰に勧められたか、感想など"
          value={item.note}
          onChange={(e) => updateMedia(item.id, { note: e.target.value })}
        />

        <div className="editor-footer">
          <span className="editor-stamp num">作成 {formatMonthDay(item.createdAt.slice(0, 10))}</span>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteMedia(item.id)}>
            削除
          </button>
        </div>
      </div>
    </aside>
  );
}
