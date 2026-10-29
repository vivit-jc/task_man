import { useState } from 'react';

interface Props {
  placeholder: string;
  onAdd: (title: string) => void;
}

/** Enter で連続入力できる追加欄。入力欄は追加後もフォーカスを保つ */
export function QuickAdd({ placeholder, onAdd }: Props) {
  const [title, setTitle] = useState('');

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  };

  return (
    <form
      className="quick-add"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        className="field"
        value={title}
        placeholder={placeholder}
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
      <button type="submit" className="btn btn-sm" disabled={!title.trim()}>
        追加
      </button>
    </form>
  );
}
