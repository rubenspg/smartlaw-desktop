import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 4500;

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, kind, message }]);
    return id;
  }, []);

  const api: ToastApi = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
        {items.map((t) => (
          <Toast key={t.id} item={t} onDismiss={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const KIND_STYLES: Record<ToastKind, { icon: typeof CheckCircle2; classes: string }> = {
  success: { icon: CheckCircle2, classes: 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400' },
  error: { icon: AlertCircle, classes: 'border-destructive/30 text-destructive' },
  info: { icon: Info, classes: 'border-border text-foreground' },
};

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const { icon: Icon, classes } = KIND_STYLES[item.kind];

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-premium animate-fade-in-up',
        classes,
      )}
    >
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <p className="text-sm font-medium text-foreground flex-1 break-words">{item.message}</p>
      <button
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
