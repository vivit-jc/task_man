import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

const PRESS_MS = 600;
/** これ以上動いたらドラッグや選択とみなして長押しをやめる */
const MOVE_TOLERANCE = 6;
/** チップやボタンの上で押したときは、そちらの操作を優先する */
const IGNORE_SELECTOR = 'button, input, a, .chip, .modal-backdrop';

/**
 * 要素を押し続けたら onLongPress を呼ぶ。
 * 押している間は pressing が true になるので、見た目の手がかりに使う。
 */
export function useLongPress(onLongPress: () => void) {
  const [pressing, setPressing] = useState(false);
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const callback = useRef(onLongPress);
  callback.current = onLongPress;

  const cancel = () => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
    setPressing(false);
  };

  useEffect(() => cancel, []);

  return {
    pressing,
    handlers: {
      onPointerDown(e: PointerEvent) {
        if (e.button !== 0) return;
        if ((e.target as Element).closest(IGNORE_SELECTOR)) return;
        origin.current = { x: e.clientX, y: e.clientY };
        setPressing(true);
        timer.current = window.setTimeout(() => {
          cancel();
          callback.current();
        }, PRESS_MS);
      },
      onPointerMove(e: PointerEvent) {
        const start = origin.current;
        if (!start) return;
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE) cancel();
      },
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
    },
  };
}
