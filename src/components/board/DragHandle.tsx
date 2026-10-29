import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';

interface Props extends HTMLAttributes<HTMLButtonElement> {
  label: string;
  small?: boolean;
}

/**
 * 並べ替えの持ち手。ドラッグの起点をここだけに絞ることで、
 * カード本体での文字選択やクリックとドラッグが取り合いにならないようにする。
 */
export const DragHandle = forwardRef<HTMLButtonElement, Props>(function DragHandle(
  { label, small, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={['drag-handle', small ? 'is-small' : '', className ?? ''].filter(Boolean).join(' ')}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      tabIndex={label ? undefined : -1}
      // 持ち手のクリックで詳細パネルが開かないようにする
      onClick={(e) => e.stopPropagation()}
      {...rest}
    >
      <svg viewBox="0 0 8 14" width="8" height="14" aria-hidden="true">
        <circle cx="2" cy="2" r="1.2" />
        <circle cx="6" cy="2" r="1.2" />
        <circle cx="2" cy="7" r="1.2" />
        <circle cx="6" cy="7" r="1.2" />
        <circle cx="2" cy="12" r="1.2" />
        <circle cx="6" cy="12" r="1.2" />
      </svg>
    </button>
  );
});
