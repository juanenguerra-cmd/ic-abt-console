import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { Undo2, X, CheckCircle } from "lucide-react";

interface UndoAction {
  id: string;
  message: string;
  onUndo: () => void;
  timeoutMs?: number;
}

interface UndoToastContextValue {
  showUndo: (action: Omit<UndoAction, "id">) => void;
}

const UndoToastContext = createContext<UndoToastContextValue>({
  showUndo: () => {},
});

export const useUndoToast = () => useContext(UndoToastContext);

interface ActiveToast extends UndoAction {
  expiresAt: number;
  progress: number;
}

export const UndoToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const handleUndo = useCallback((toast: ActiveToast) => {
    toast.onUndo();
    dismissToast(toast.id);
  }, [dismissToast]);

  const showUndo = useCallback((action: Omit<UndoAction, "id">) => {
    const id = `undo-${Date.now()}-${Math.random()}`;
    const timeoutMs = action.timeoutMs ?? 5000;
    const expiresAt = Date.now() + timeoutMs;

    setToasts(prev => [...prev.slice(-2), { ...action, id, expiresAt, progress: 100 }]);

    const timer = setTimeout(() => {
      dismissToast(id);
    }, timeoutMs);
    timersRef.current.set(id, timer);
  }, [dismissToast]);

  // Animate progress bars
  useEffect(() => {
    if (toasts.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setToasts(prev =>
        prev.map(t => ({
          ...t,
          progress: Math.max(0, ((t.expiresAt - now) / (t.timeoutMs ?? 5000)) * 100),
        }))
      );
    }, 100);
    return () => clearInterval(interval);
  }, [toasts.length]);

  return (
    <UndoToastContext.Provider value={{ showUndo }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Undo notifications"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex items-center gap-3 bg-neutral-900 text-white text-sm rounded-lg shadow-xl px-4 py-3 min-w-[280px] max-w-sm relative overflow-hidden"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => handleUndo(toast)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-white/20 hover:bg-white/30 text-white font-medium text-xs transition-colors"
              aria-label={`Undo: ${toast.message}`}
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo
            </button>
            <button
              onClick={() => dismissToast(toast.id)}
              className="p-1 text-white/60 hover:text-white rounded transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {/* Progress bar */}
            <div
              className="absolute bottom-0 left-0 h-0.5 bg-emerald-400 transition-all duration-100"
              style={{ width: `${toast.progress}%` }}
              role="progressbar"
              aria-valuenow={Math.round(toast.progress)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        ))}
      </div>
    </UndoToastContext.Provider>
  );
};
