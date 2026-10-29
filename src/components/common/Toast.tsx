import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

const DURATION = 7000;

export function Toast() {
  const toast = useAppStore((s) => s.toast);
  const dismiss = useAppStore((s) => s.dismissToast);
  const undo = useAppStore((s) => s.undo);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(dismiss, DURATION);
    return () => window.clearTimeout(timer);
  }, [toast, dismiss]);

  if (!toast) return null;

  return (
    <div className="toast" role="status">
      <span>{toast.message}</span>
      {toast.undoable && (
        <button type="button" className="btn btn-sm" onClick={undo}>
          元に戻す
        </button>
      )}
      <button type="button" className="btn btn-quiet btn-sm" onClick={dismiss} aria-label="閉じる">
        ✕
      </button>
    </div>
  );
}
