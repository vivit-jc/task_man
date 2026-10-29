import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { isPlausibleIsoDate, today } from '../../lib/date';

/**
 * イベントの追加欄。QuickAdd はタイトルしか受けないので、日付を持つこちらを別に用意する。
 * 追加しても日付は残すので、同じ日の予定を続けて入れられる。
 */
export function EventQuickAdd() {
  const addEvent = useAppStore((s) => s.addEvent);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today());

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    // 打ちかけの日付のまま追加されないように、読めない値は今日として扱う
    addEvent({ title: trimmed, date: isPlausibleIsoDate(date) ? date : today() });
    setTitle('');
  };

  return (
    <form
      className="quick-add event-add"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        className="field"
        value={title}
        placeholder="イベントを追加（例: 展示会の搬入）"
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
      <input
        type="date"
        className="field num"
        value={date}
        aria-label="イベントの日付"
        onChange={(e) => setDate(e.target.value)}
      />
      <button type="submit" className="btn btn-sm" disabled={!title.trim()}>
        追加
      </button>
    </form>
  );
}
