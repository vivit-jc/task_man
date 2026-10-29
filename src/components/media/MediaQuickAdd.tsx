import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';

/**
 * 娯楽の追加欄。題名と種類を受ける。追加しても種類は残すので、同じ種類を続けて入れられる。
 * 追加したものは「気になる」に入る。
 */
export function MediaQuickAdd() {
  const mediaKinds = useAppStore((s) => s.mediaKinds);
  const filterMediaKindIds = useAppStore((s) => s.ui.filterMediaKindIds);
  const addMedia = useAppStore((s) => s.addMedia);
  const [title, setTitle] = useState('');
  // 種類で絞り込んでいるなら、その種類を最初から選んでおく
  const [kindId, setKindId] = useState<string>(
    filterMediaKindIds.length === 1 ? filterMediaKindIds[0]! : (mediaKinds[0]?.id ?? ''),
  );
  // 選んでいた種類が消されたら未分類に戻す
  const validKindId = mediaKinds.some((k) => k.id === kindId) ? kindId : '';

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    addMedia({ title: trimmed, kindId: validKindId || null });
    setTitle('');
  };

  return (
    <form
      className="quick-add media-add"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        className="field"
        value={title}
        placeholder="気になるものを追加（例: 観たい映画のタイトル）"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          // 日本語入力の変換確定の Enter では追加しない
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
            return;
          }
          if (e.key === 'Escape') {
            setTitle('');
            e.currentTarget.blur();
          }
        }}
      />
      <select
        className="field media-kind-select"
        value={validKindId}
        aria-label="種類"
        onChange={(e) => setKindId(e.target.value)}
      >
        {mediaKinds.map((kind) => (
          <option key={kind.id} value={kind.id}>
            {kind.name}
          </option>
        ))}
        <option value="">未分類</option>
      </select>
      <button type="submit" className="btn btn-sm" disabled={!title.trim()}>
        追加
      </button>
    </form>
  );
}
