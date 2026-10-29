import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { View } from '../../types';

const VIEW_BY_KEY: Record<string, View> = {
  '1': 'board',
  '2': 'week',
  '3': 'month',
  '4': 'event',
  '5': 'media',
};

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

/** n: 追加欄へ / 1〜5: 表示切り替え。テキスト入力中は何もしない */
export function useShortcuts(searchRef: React.RefObject<HTMLInputElement>): void {
  const setUi = useAppStore((s) => s.setUi);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;

      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === 'n') {
        const input = document.querySelector<HTMLInputElement>('.quick-add input');
        if (input) {
          e.preventDefault();
          input.focus();
          input.scrollIntoView({ block: 'nearest' });
        }
        return;
      }
      const view = VIEW_BY_KEY[e.key];
      if (view) {
        e.preventDefault();
        setUi({ view });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchRef, setUi]);
}
