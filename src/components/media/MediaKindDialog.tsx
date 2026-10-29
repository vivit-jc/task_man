import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { TAG_COLORS } from '../../store/persist';
import type { MediaKind } from '../../types';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface Props {
  onClose: () => void;
}

/** 娯楽の種類を足す・名前と色を変える・消す */
export function MediaKindDialog({ onClose }: Props) {
  const mediaKinds = useAppStore((s) => s.mediaKinds);
  const media = useAppStore((s) => s.media);
  const addMediaKind = useAppStore((s) => s.addMediaKind);
  const updateMediaKind = useAppStore((s) => s.updateMediaKind);
  const deleteMediaKind = useAppStore((s) => s.deleteMediaKind);
  const [newName, setNewName] = useState('');
  const [pending, setPending] = useState<MediaKind | null>(null);

  useEffect(() => {
    // 削除の確認を出しているあいだは、そちらの Esc に任せる
    if (pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pending]);

  const submit = () => {
    if (addMediaKind(newName)) setNewName('');
  };

  return (
    <>
      <div className="modal-backdrop" onMouseDown={onClose}>
        <div
          className="modal kind-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="種類を編集"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 className="modal-title">種類を編集</h2>

          {mediaKinds.length === 0 && <p className="modal-body">種類はまだありません</p>}
          <ul className="kind-list">
            {mediaKinds.map((kind) => {
              const used = media.filter((m) => m.kindId === kind.id).length;
              return (
                <li key={kind.id}>
                  <span className="kind-swatch" style={{ background: kind.color }} />
                  <input
                    className="field"
                    value={kind.name}
                    aria-label="種類の名前"
                    onChange={(e) => updateMediaKind(kind.id, { name: e.target.value })}
                    // 空のまま離れると、チップに何も出なくなるので仮の名前を入れる
                    onBlur={(e) => {
                      if (!e.target.value.trim()) updateMediaKind(kind.id, { name: '無題' });
                    }}
                  />
                  <span className="kind-colors" role="group" aria-label={`${kind.name} の色`}>
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={kind.color === color ? 'is-on' : ''}
                        style={{ background: color }}
                        aria-label={color}
                        aria-pressed={kind.color === color}
                        onClick={() => updateMediaKind(kind.id, { color })}
                      />
                    ))}
                  </span>
                  <span className="kind-used num">{used}件</span>
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    onClick={() => setPending(kind)}
                    aria-label={`種類「${kind.name}」を削除`}
                  >
                    削除
                  </button>
                </li>
              );
            })}
          </ul>

          <form
            className="quick-add"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              className="field"
              value={newName}
              placeholder="新しい種類（例: ドラマ、舞台）"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <button type="submit" className="btn btn-sm" disabled={!newName.trim()}>
              追加
            </button>
          </form>

          <div className="modal-actions kind-dialog-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              閉じる
            </button>
          </div>
        </div>
      </div>

      {pending && (
        <ConfirmDialog
          title="種類を削除する"
          body={(() => {
            const used = media.filter((m) => m.kindId === pending.id).length;
            return used > 0
              ? `「${pending.name}」を削除します。この種類の${used}件は未分類になります（消えはしません）。`
              : `「${pending.name}」を削除します。この種類のものはありません。`;
          })()}
          confirmLabel="削除する"
          danger
          onCancel={() => setPending(null)}
          onConfirm={() => {
            deleteMediaKind(pending.id);
            setPending(null);
          }}
        />
      )}
    </>
  );
}
